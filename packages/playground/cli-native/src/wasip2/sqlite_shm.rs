//! Host-owned shared memory for SQLite WAL indexes.
//!
//! WASI components cannot share their linear memories. Each component keeps a
//! private WAL-index mirror and exchanges changed ranges with this process-local
//! canonical image at SQLite's lock and barrier boundaries.

use std::{
    collections::{HashMap, VecDeque},
    io,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex, OnceLock, RwLock, Weak,
    },
};

use wasmtime_wasi::filesystem::File;

pub(crate) use super::component::bindings::wordpress_playground::filesystem_locks::sqlite_wal_shm::{
    ExchangeResult, ShmRange,
};

const MAX_REGION_SIZE: usize = 1024 * 1024;
const MAX_REGIONS: usize = 2048;
const MAX_TOTAL_CANONICAL_BYTES: usize = 64 * 1024 * 1024;
const MAX_DIRTY_RANGES: usize = 131_072;
const MAX_EXCHANGE_BYTES: usize = 16 * 1024 * 1024;
const MAX_RESPONSE_RANGES: usize = MAX_DIRTY_RANGES + MAX_REGIONS;
const MAX_HISTORY_GENERATIONS: usize = 64;
const MAX_HISTORY_RANGES: usize = 4096;
const REGISTRY_SHARD_COUNT: usize = 64;

#[derive(Debug)]
pub(crate) enum ShmError {
    InvalidArgument,
    Conflict,
    ResourceExhausted,
    Io(io::Error),
}

pub struct WalShmSession {
    identity: FileIdentity,
    state: Arc<FileState>,
    // Keep the descriptor identity alive for exactly as long as the imported
    // resource. FileState deliberately does not retain an OS file handle.
    _descriptor: File,
}

impl WalShmSession {
    pub(crate) fn open(descriptor: File) -> Result<Self, ShmError> {
        let identity = file_identity(&descriptor)?;
        let state = registry().state(identity)?;
        Ok(Self {
            identity,
            state,
            _descriptor: descriptor,
        })
    }

    pub(crate) fn reset(&self) -> Result<(), ShmError> {
        self.state.reset()
    }

    pub(crate) fn current_epoch(&self) -> u64 {
        self.state.current_epoch()
    }

    pub(crate) fn exchange(
        &self,
        region_size: u32,
        known_generations: &[u64],
        dirty_ranges: &[ShmRange],
        expected: &[u8],
        replacement: &[u8],
        force_refresh: bool,
    ) -> Result<ExchangeResult, ShmError> {
        self.state.exchange(
            region_size,
            known_generations,
            dirty_ranges,
            expected,
            replacement,
            force_refresh,
        )
    }
}

impl Drop for WalShmSession {
    fn drop(&mut self) {
        registry().remove_if_last(self.identity, &self.state);
    }
}

#[derive(Clone, Copy, Debug, Hash, PartialEq, Eq)]
struct FileIdentity {
    volume: u64,
    file_id_high: u64,
    file_id_low: u64,
}

struct Registry {
    shards: [Mutex<HashMap<FileIdentity, Weak<FileState>>>; REGISTRY_SHARD_COUNT],
}

impl Default for Registry {
    fn default() -> Self {
        Self {
            shards: std::array::from_fn(|_| Mutex::new(HashMap::new())),
        }
    }
}

impl Registry {
    fn state(&self, identity: FileIdentity) -> Result<Arc<FileState>, ShmError> {
        let mut files = self.shards[Self::shard_index(identity)]
            .lock()
            .map_err(|_| ShmError::Io(io::Error::other("SQLite SHM registry was poisoned")))?;
        if let Some(state) = files.get(&identity).and_then(std::sync::Weak::upgrade) {
            return Ok(state);
        }
        let state = Arc::new(FileState::default());
        files.insert(identity, Arc::downgrade(&state));
        Ok(state)
    }

    fn remove_if_last(&self, identity: FileIdentity, state: &Arc<FileState>) {
        if Arc::strong_count(state) != 1 {
            return;
        }
        let Ok(mut files) = self.shards[Self::shard_index(identity)].lock() else {
            return;
        };
        // Recheck under the shard lock: an opener may have upgraded the weak
        // reference while this session was waiting for the lock.
        if Arc::strong_count(state) != 1 {
            return;
        }
        let state_weak = Arc::downgrade(state);
        if files
            .get(&identity)
            .is_some_and(|registered| Weak::ptr_eq(registered, &state_weak))
        {
            files.remove(&identity);
        }
    }

    fn shard_index(identity: FileIdentity) -> usize {
        debug_assert!(REGISTRY_SHARD_COUNT.is_power_of_two());
        let mixed = identity.volume
            ^ identity.file_id_high.rotate_left(21)
            ^ identity.file_id_low.rotate_left(42);
        let folded = mixed ^ (mixed >> 32);
        (folded as usize) & (REGISTRY_SHARD_COUNT - 1)
    }
}

fn registry() -> &'static Registry {
    static REGISTRY: OnceLock<Registry> = OnceLock::new();
    REGISTRY.get_or_init(Registry::default)
}

#[derive(Default)]
struct FileState {
    inner: RwLock<State>,
    published_epoch: AtomicU64,
}

#[derive(Default)]
struct State {
    region_size: Option<usize>,
    regions: Vec<Region>,
    next_generation: u64,
}

struct Region {
    bytes: Box<[u8]>,
    generation: u64,
    history_floor: u64,
    history_range_count: usize,
    history: VecDeque<GenerationDelta>,
}

struct GenerationDelta {
    generation: u64,
    ranges: Vec<ByteRange>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ByteRange {
    offset: usize,
    length: usize,
}

struct ValidatedRange {
    region: usize,
    offset: usize,
    data_offset: usize,
    length: usize,
}

impl FileState {
    fn current_epoch(&self) -> u64 {
        self.published_epoch.load(Ordering::Acquire)
    }

    fn reset(&self) -> Result<(), ShmError> {
        let mut state = self
            .inner
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let next_generation = state
            .next_generation
            .checked_add(1)
            .ok_or(ShmError::ResourceExhausted)?;
        state.regions.clear();
        // Never reuse a generation after a DMS reset while this process lives.
        state.next_generation = next_generation.max(1);
        self.published_epoch
            .store(state.next_generation, Ordering::Release);
        Ok(())
    }

    fn exchange(
        &self,
        region_size: u32,
        known_generations: &[u64],
        dirty_ranges: &[ShmRange],
        expected: &[u8],
        replacement: &[u8],
        force_refresh: bool,
    ) -> Result<ExchangeResult, ShmError> {
        let region_size = validate_region_size(region_size)?;
        validate_exchange_limits(
            known_generations.len(),
            region_size,
            dirty_ranges.len(),
            expected.len(),
            replacement.len(),
        )?;
        let ranges = validate_ranges(
            known_generations.len(),
            region_size,
            dirty_ranges,
            expected,
            replacement,
        )?;
        if ranges.is_empty() {
            let state = self
                .inner
                .read()
                .map_err(|_| ShmError::Io(io::Error::other("SQLite SHM state was poisoned")))?;
            match state.region_size {
                Some(configured) if configured != region_size => {
                    return Err(ShmError::InvalidArgument)
                }
                Some(_) if state.regions.len() >= known_generations.len() => {
                    return build_read_result(&state, known_generations, force_refresh)
                }
                None if known_generations.is_empty() => {
                    return Ok(ExchangeResult {
                        epoch: state.next_generation,
                        generations: Vec::new(),
                        updates: Vec::new(),
                        data: Vec::new(),
                    })
                }
                Some(_) | None => {}
            }
        }
        let mut state = self
            .inner
            .write()
            .map_err(|_| ShmError::Io(io::Error::other("SQLite SHM state was poisoned")))?;
        let original_region_size = state.region_size;
        let original_region_count = state.regions.len();
        let original_next_generation = state.next_generation;
        match state.region_size {
            Some(configured) if configured != region_size => return Err(ShmError::InvalidArgument),
            None => state.region_size = Some(region_size),
            Some(_) => {}
        }
        if let Err(error) = state.ensure_regions(known_generations.len(), region_size) {
            state.regions.truncate(original_region_count);
            state.next_generation = original_next_generation;
            state.region_size = original_region_size;
            return Err(error);
        }

        let prepared = prepare_exchange(
            &mut state,
            known_generations,
            &ranges,
            expected,
            replacement,
            force_refresh,
        );
        let PreparedExchange {
            mut changed_by_region,
            response_ranges,
            planned_generations,
            next_generation,
            mut result,
        } = match prepared {
            Ok(prepared) => prepared,
            Err(error) => {
                state.regions.truncate(original_region_count);
                state.next_generation = original_next_generation;
                state.region_size = original_region_size;
                return Err(error);
            }
        };

        // Everything that can fail has completed. From here through result
        // construction, every Vec has enough reserved capacity.
        for range in &ranges {
            let canonical =
                &mut state.regions[range.region].bytes[range.offset..range.offset + range.length];
            let replacement = &replacement[range.data_offset..range.data_offset + range.length];
            canonical.copy_from_slice(replacement);
        }
        for (region_index, ranges) in changed_by_region.iter_mut().enumerate() {
            if !ranges.is_empty() {
                state.regions[region_index]
                    .record_delta(planned_generations[region_index], std::mem::take(ranges));
            }
        }
        state.next_generation = next_generation;
        if state.next_generation != original_next_generation {
            self.published_epoch
                .store(state.next_generation, Ordering::Release);
        }

        result.generations = planned_generations;
        for (region_index, ranges) in response_ranges.into_iter().enumerate() {
            let region = &state.regions[region_index];
            for range in ranges {
                result.updates.push(ShmRange {
                    region: region_index as u32,
                    offset: range.offset as u32,
                    data_offset: result.data.len() as u32,
                    length: range.length as u32,
                });
                result
                    .data
                    .extend_from_slice(&region.bytes[range.offset..range.offset + range.length]);
            }
        }
        Ok(result)
    }
}

struct PreparedExchange {
    changed_by_region: Vec<Vec<ByteRange>>,
    response_ranges: Vec<Vec<ByteRange>>,
    planned_generations: Vec<u64>,
    next_generation: u64,
    result: ExchangeResult,
}

fn build_read_result(
    state: &State,
    known_generations: &[u64],
    force_refresh: bool,
) -> Result<ExchangeResult, ShmError> {
    let mut generations = try_vec(known_generations.len())?;
    let mut all_current = !force_refresh;
    for (region_index, known) in known_generations.iter().copied().enumerate() {
        let region = &state.regions[region_index];
        if known > region.generation {
            return Err(ShmError::InvalidArgument);
        }
        generations.push(region.generation);
        all_current &= known == region.generation;
    }
    if all_current {
        return Ok(ExchangeResult {
            epoch: state.next_generation,
            generations,
            updates: Vec::new(),
            data: Vec::new(),
        });
    }

    let mut response_ranges = try_nested_vec(known_generations.len())?;
    for (region_index, known) in known_generations.iter().copied().enumerate() {
        let region = &state.regions[region_index];
        response_ranges[region_index] = region.ranges_since(known, force_refresh)?;
    }
    let (response_range_count, response_bytes) = response_totals(&response_ranges)?;
    let mut result = allocate_result(response_range_count, response_bytes, state.next_generation)?;
    result.generations = generations;
    fill_result(state, response_ranges, &mut result);
    Ok(result)
}

fn response_totals(ranges_by_region: &[Vec<ByteRange>]) -> Result<(usize, usize), ShmError> {
    let mut range_count = 0usize;
    let mut byte_count = 0usize;
    for ranges in ranges_by_region {
        range_count = range_count
            .checked_add(ranges.len())
            .ok_or(ShmError::ResourceExhausted)?;
        for range in ranges {
            byte_count = byte_count
                .checked_add(range.length)
                .ok_or(ShmError::ResourceExhausted)?;
        }
    }
    if range_count > MAX_RESPONSE_RANGES
        || byte_count > MAX_TOTAL_CANONICAL_BYTES
        || byte_count > u32::MAX as usize
    {
        return Err(ShmError::ResourceExhausted);
    }
    Ok((range_count, byte_count))
}

fn allocate_result(
    range_count: usize,
    byte_count: usize,
    epoch: u64,
) -> Result<ExchangeResult, ShmError> {
    let mut result = ExchangeResult {
        epoch,
        generations: Vec::new(),
        updates: Vec::new(),
        data: Vec::new(),
    };
    result
        .updates
        .try_reserve_exact(range_count)
        .map_err(|_| ShmError::ResourceExhausted)?;
    result
        .data
        .try_reserve_exact(byte_count)
        .map_err(|_| ShmError::ResourceExhausted)?;
    Ok(result)
}

fn fill_result(state: &State, ranges_by_region: Vec<Vec<ByteRange>>, result: &mut ExchangeResult) {
    for (region_index, ranges) in ranges_by_region.into_iter().enumerate() {
        let region = &state.regions[region_index];
        for range in ranges {
            result.updates.push(ShmRange {
                region: region_index as u32,
                offset: range.offset as u32,
                data_offset: result.data.len() as u32,
                length: range.length as u32,
            });
            result
                .data
                .extend_from_slice(&region.bytes[range.offset..range.offset + range.length]);
        }
    }
}

fn prepare_exchange(
    state: &mut State,
    known_generations: &[u64],
    ranges: &[ValidatedRange],
    expected: &[u8],
    replacement: &[u8],
    force_refresh: bool,
) -> Result<PreparedExchange, ShmError> {
    for (known, region) in known_generations.iter().zip(&state.regions) {
        if *known > region.generation {
            return Err(ShmError::InvalidArgument);
        }
    }
    for range in ranges {
        let canonical =
            &state.regions[range.region].bytes[range.offset..range.offset + range.length];
        let expected = &expected[range.data_offset..range.data_offset + range.length];
        if canonical != expected {
            return Err(ShmError::Conflict);
        }
    }

    let mut submitted_by_region = try_nested_vec(known_generations.len())?;
    let mut changed_by_region = try_nested_vec(known_generations.len())?;
    for range in ranges {
        submitted_by_region[range.region]
            .try_reserve(1)
            .map_err(|_| ShmError::ResourceExhausted)?;
        submitted_by_region[range.region].push(ByteRange {
            offset: range.offset,
            length: range.length,
        });
        let canonical =
            &state.regions[range.region].bytes[range.offset..range.offset + range.length];
        let replacement = &replacement[range.data_offset..range.data_offset + range.length];
        if canonical != replacement {
            changed_by_region[range.region]
                .try_reserve(1)
                .map_err(|_| ShmError::ResourceExhausted)?;
            changed_by_region[range.region].push(ByteRange {
                offset: range.offset,
                length: range.length,
            });
        }
    }
    for region_index in 0..known_generations.len() {
        if !submitted_by_region[region_index].is_empty() {
            submitted_by_region[region_index] =
                merge_byte_ranges(std::mem::take(&mut submitted_by_region[region_index]))?;
        }
        if !changed_by_region[region_index].is_empty() {
            changed_by_region[region_index] =
                merge_byte_ranges(std::mem::take(&mut changed_by_region[region_index]))?;
        }
    }

    let mut next_generation = state.next_generation;
    let mut planned_generations = try_vec(known_generations.len())?;
    for (region_index, region) in state
        .regions
        .iter_mut()
        .take(known_generations.len())
        .enumerate()
    {
        if changed_by_region[region_index].is_empty() {
            planned_generations.push(region.generation);
        } else {
            next_generation = next_generation
                .checked_add(1)
                .ok_or(ShmError::ResourceExhausted)?;
            planned_generations.push(next_generation);
            region
                .history
                .try_reserve(1)
                .map_err(|_| ShmError::ResourceExhausted)?;
        }
    }

    let mut response_ranges = try_nested_vec(known_generations.len())?;
    for (region_index, known) in known_generations.iter().copied().enumerate() {
        let region = &state.regions[region_index];
        let remote = region.ranges_since(known, force_refresh)?;
        response_ranges[region_index] =
            subtract_byte_ranges(remote, &submitted_by_region[region_index])?;
    }
    let (response_range_count, response_bytes) = response_totals(&response_ranges)?;
    let result = allocate_result(response_range_count, response_bytes, next_generation)?;
    Ok(PreparedExchange {
        changed_by_region,
        response_ranges,
        planned_generations,
        next_generation,
        result,
    })
}

impl State {
    fn ensure_regions(&mut self, count: usize, region_size: usize) -> Result<(), ShmError> {
        self.regions
            .try_reserve(count.saturating_sub(self.regions.len()))
            .map_err(|_| ShmError::ResourceExhausted)?;
        while self.regions.len() < count {
            let generation = self.allocate_generation()?;
            self.regions.push(Region::new(region_size, generation)?);
        }
        Ok(())
    }

    fn allocate_generation(&mut self) -> Result<u64, ShmError> {
        self.next_generation = self
            .next_generation
            .checked_add(1)
            .ok_or(ShmError::ResourceExhausted)?
            .max(1);
        Ok(self.next_generation)
    }
}

impl Region {
    fn new(region_size: usize, generation: u64) -> Result<Self, ShmError> {
        let mut bytes = Vec::new();
        bytes
            .try_reserve_exact(region_size)
            .map_err(|_| ShmError::ResourceExhausted)?;
        bytes.resize(region_size, 0);
        Ok(Self {
            bytes: bytes.into_boxed_slice(),
            generation,
            history_floor: generation,
            history_range_count: 0,
            history: VecDeque::new(),
        })
    }

    fn record_delta(&mut self, generation: u64, ranges: Vec<ByteRange>) {
        self.generation = generation;
        self.history_range_count += ranges.len();
        self.history
            .push_back(GenerationDelta { generation, ranges });
        while self.history.len() > MAX_HISTORY_GENERATIONS
            || self.history_range_count > MAX_HISTORY_RANGES
        {
            let Some(removed) = self.history.pop_front() else {
                break;
            };
            self.history_range_count -= removed.ranges.len();
            self.history_floor = removed.generation;
        }
    }

    fn ranges_since(&self, known: u64, force_refresh: bool) -> Result<Vec<ByteRange>, ShmError> {
        if !force_refresh && known == self.generation {
            return Ok(Vec::new());
        }
        let known_is_retained = known == self.generation
            || known == self.history_floor
            || self.history.iter().any(|delta| delta.generation == known);
        if force_refresh || known < self.history_floor || !known_is_retained {
            let mut full = try_vec(1)?;
            full.push(ByteRange {
                offset: 0,
                length: self.bytes.len(),
            });
            return Ok(full);
        }
        let retained_count = self
            .history
            .iter()
            .filter(|delta| delta.generation > known)
            .map(|delta| delta.ranges.len())
            .sum::<usize>();
        let mut ranges = try_vec(retained_count)?;
        for delta in &self.history {
            if delta.generation > known {
                ranges.extend_from_slice(&delta.ranges);
            }
        }
        merge_byte_ranges(ranges)
    }
}

fn try_vec<T>(capacity: usize) -> Result<Vec<T>, ShmError> {
    let mut values = Vec::new();
    values
        .try_reserve_exact(capacity)
        .map_err(|_| ShmError::ResourceExhausted)?;
    Ok(values)
}

fn try_nested_vec(count: usize) -> Result<Vec<Vec<ByteRange>>, ShmError> {
    let mut regions = try_vec(count)?;
    for _ in 0..count {
        regions.push(Vec::new());
    }
    Ok(regions)
}

fn validate_region_size(region_size: u32) -> Result<usize, ShmError> {
    let region_size = usize::try_from(region_size).map_err(|_| ShmError::InvalidArgument)?;
    if region_size == 0 || region_size > MAX_REGION_SIZE || region_size % 4 != 0 {
        return Err(ShmError::InvalidArgument);
    }
    Ok(region_size)
}

fn validate_exchange_limits(
    region_count: usize,
    region_size: usize,
    dirty_range_count: usize,
    expected_bytes: usize,
    replacement_bytes: usize,
) -> Result<(), ShmError> {
    let canonical_bytes = region_count
        .checked_mul(region_size)
        .ok_or(ShmError::ResourceExhausted)?;
    if region_count > MAX_REGIONS
        || canonical_bytes > MAX_TOTAL_CANONICAL_BYTES
        || dirty_range_count > MAX_DIRTY_RANGES
        || expected_bytes > MAX_EXCHANGE_BYTES
        || replacement_bytes > MAX_EXCHANGE_BYTES
    {
        return Err(ShmError::ResourceExhausted);
    }
    Ok(())
}

fn validate_ranges(
    region_count: usize,
    region_size: usize,
    ranges: &[ShmRange],
    expected: &[u8],
    replacement: &[u8],
) -> Result<Vec<ValidatedRange>, ShmError> {
    if expected.len() != replacement.len() {
        return Err(ShmError::InvalidArgument);
    }
    let mut validated = try_vec(ranges.len())?;
    for range in ranges {
        let region = usize::try_from(range.region).map_err(|_| ShmError::InvalidArgument)?;
        let offset = usize::try_from(range.offset).map_err(|_| ShmError::InvalidArgument)?;
        let data_offset =
            usize::try_from(range.data_offset).map_err(|_| ShmError::InvalidArgument)?;
        let length = usize::try_from(range.length).map_err(|_| ShmError::InvalidArgument)?;
        let region_end = offset
            .checked_add(length)
            .ok_or(ShmError::InvalidArgument)?;
        let data_end = data_offset
            .checked_add(length)
            .ok_or(ShmError::InvalidArgument)?;
        if region >= region_count
            || length == 0
            || offset % 4 != 0
            || length % 4 != 0
            || region_end > region_size
            || data_end > expected.len()
        {
            return Err(ShmError::InvalidArgument);
        }
        validated.push(ValidatedRange {
            region,
            offset,
            data_offset,
            length,
        });
    }

    validated.sort_by_key(|range| (range.region, range.offset));
    for pair in validated.windows(2) {
        if pair[0].region == pair[1].region && pair[0].offset + pair[0].length > pair[1].offset {
            return Err(ShmError::InvalidArgument);
        }
    }
    let mut data_ranges = try_vec(validated.len())?;
    for range in &validated {
        data_ranges.push((range.data_offset, range.length));
    }
    data_ranges.sort_unstable();
    let mut next_data_offset = 0;
    for (offset, length) in data_ranges {
        if offset != next_data_offset {
            return Err(ShmError::InvalidArgument);
        }
        next_data_offset += length;
    }
    if next_data_offset != expected.len() {
        return Err(ShmError::InvalidArgument);
    }
    Ok(validated)
}

fn merge_byte_ranges(mut ranges: Vec<ByteRange>) -> Result<Vec<ByteRange>, ShmError> {
    ranges.sort_by_key(|range| range.offset);
    let mut merged: Vec<ByteRange> = try_vec(ranges.len())?;
    for range in ranges {
        if let Some(previous) = merged.last_mut() {
            let previous_end = previous.offset + previous.length;
            if range.offset <= previous_end {
                previous.length = previous_end
                    .max(range.offset + range.length)
                    .saturating_sub(previous.offset);
                continue;
            }
        }
        merged.push(range);
    }
    Ok(merged)
}

fn subtract_byte_ranges(
    ranges: Vec<ByteRange>,
    excluded: &[ByteRange],
) -> Result<Vec<ByteRange>, ShmError> {
    let capacity = ranges
        .len()
        .checked_add(excluded.len())
        .and_then(|count| count.checked_add(1))
        .ok_or(ShmError::ResourceExhausted)?;
    let mut remaining = try_vec(capacity)?;
    let mut exclusion_index = 0;
    for range in ranges {
        let end = range.offset + range.length;
        let mut cursor = range.offset;
        while exclusion_index < excluded.len()
            && excluded[exclusion_index].offset + excluded[exclusion_index].length <= cursor
        {
            exclusion_index += 1;
        }
        let mut scan = exclusion_index;
        while scan < excluded.len() && excluded[scan].offset < end {
            let exclusion = excluded[scan];
            if exclusion.offset > cursor {
                remaining.push(ByteRange {
                    offset: cursor,
                    length: exclusion.offset.min(end) - cursor,
                });
            }
            cursor = cursor.max(exclusion.offset + exclusion.length);
            if cursor >= end {
                break;
            }
            scan += 1;
        }
        if cursor < end {
            remaining.push(ByteRange {
                offset: cursor,
                length: end - cursor,
            });
        }
        while exclusion_index < excluded.len()
            && excluded[exclusion_index].offset + excluded[exclusion_index].length <= end
        {
            exclusion_index += 1;
        }
    }
    Ok(remaining)
}

#[cfg(unix)]
#[allow(clippy::unnecessary_cast)] // libc uses different dev_t/ino_t widths by target.
fn file_identity(file: &File) -> Result<FileIdentity, ShmError> {
    use std::os::fd::AsRawFd;

    let mut metadata = std::mem::MaybeUninit::<libc::stat>::zeroed();
    let result = unsafe { libc::fstat(file.file.as_raw_fd(), metadata.as_mut_ptr()) };
    if result != 0 {
        return Err(ShmError::Io(io::Error::last_os_error()));
    }
    let metadata = unsafe { metadata.assume_init() };
    Ok(FileIdentity {
        volume: metadata.st_dev as u64,
        file_id_high: 0,
        file_id_low: metadata.st_ino as u64,
    })
}

#[cfg(windows)]
fn file_identity(file: &File) -> Result<FileIdentity, ShmError> {
    use std::os::windows::io::AsRawHandle;

    windows_file_identity(file.file.as_raw_handle())
}

#[cfg(windows)]
fn windows_file_identity(
    handle: std::os::windows::io::RawHandle,
) -> Result<FileIdentity, ShmError> {
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::Storage::FileSystem::{
        FileIdInfo, GetFileInformationByHandleEx, FILE_ID_INFO,
    };

    let mut metadata = FILE_ID_INFO::default();
    let result = unsafe {
        GetFileInformationByHandleEx(
            handle as HANDLE,
            FileIdInfo,
            std::ptr::from_mut(&mut metadata).cast(),
            std::mem::size_of::<FILE_ID_INFO>() as u32,
        )
    };
    if result == 0 {
        return Err(ShmError::Io(io::Error::last_os_error()));
    }
    windows_file_identity_from_parts(metadata.VolumeSerialNumber, metadata.FileId.Identifier)
}

#[cfg(windows)]
fn windows_file_identity_from_parts(
    volume: u64,
    file_id: [u8; 16],
) -> Result<FileIdentity, ShmError> {
    if file_id == [0; 16] || file_id == [u8::MAX; 16] {
        return Err(ShmError::Io(io::Error::new(
            io::ErrorKind::Unsupported,
            "the filesystem did not provide a unique 128-bit file identity",
        )));
    }
    let file_id = u128::from_le_bytes(file_id);
    Ok(FileIdentity {
        volume,
        file_id_high: (file_id >> 64) as u64,
        file_id_low: file_id as u64,
    })
}

#[cfg(not(any(unix, windows)))]
fn file_identity(_file: &File) -> Result<FileIdentity, ShmError> {
    Err(ShmError::Io(io::Error::new(
        io::ErrorKind::Unsupported,
        "SQLite SHM file identity is unsupported on this host",
    )))
}

#[cfg(test)]
mod tests {
    use std::{
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc, Barrier, Weak,
        },
        thread,
    };

    #[cfg(windows)]
    use std::{
        fs::{self, OpenOptions},
        os::windows::io::AsRawHandle,
        sync::atomic::AtomicU64,
    };

    use super::{
        ByteRange, FileIdentity, FileState, Registry, ShmError, ShmRange, MAX_HISTORY_GENERATIONS,
        MAX_REGIONS,
    };

    #[cfg(windows)]
    use super::{windows_file_identity, windows_file_identity_from_parts};

    const REGION_SIZE: u32 = 32;

    #[cfg(windows)]
    static NEXT_IDENTITY_PATH: AtomicU64 = AtomicU64::new(0);

    #[cfg(windows)]
    #[test]
    fn windows_identity_preserves_all_128_file_id_bits() {
        let file_id = 0x0123_4567_89ab_cdef_fedc_ba98_7654_3210_u128;
        let identity = windows_file_identity_from_parts(7, file_id.to_le_bytes()).unwrap();

        assert_eq!(
            identity,
            FileIdentity {
                volume: 7,
                file_id_high: 0x0123_4567_89ab_cdef,
                file_id_low: 0xfedc_ba98_7654_3210,
            }
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_identity_rejects_non_unique_sentinels() {
        for file_id in [[0; 16], [u8::MAX; 16]] {
            let ShmError::Io(error) = windows_file_identity_from_parts(7, file_id).unwrap_err()
            else {
                panic!("invalid Windows identity returned the wrong error");
            };
            assert_eq!(error.kind(), std::io::ErrorKind::Unsupported);
        }
    }

    #[cfg(windows)]
    #[test]
    fn windows_identity_matches_separate_handles_for_one_file() {
        let path = std::env::temp_dir().join(format!(
            "wp-playground-shm-identity-{}-{}.tmp",
            std::process::id(),
            NEXT_IDENTITY_PATH.fetch_add(1, Ordering::Relaxed)
        ));
        let first = OpenOptions::new()
            .create_new(true)
            .read(true)
            .write(true)
            .open(&path)
            .unwrap();
        let second = OpenOptions::new()
            .read(true)
            .write(true)
            .open(&path)
            .unwrap();

        assert_eq!(
            windows_file_identity(first.as_raw_handle()).unwrap(),
            windows_file_identity(second.as_raw_handle()).unwrap()
        );

        drop(first);
        drop(second);
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn exchanges_disjoint_stale_ranges_and_returns_only_deltas() {
        let state = FileState::default();
        let first = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        assert_eq!(first.updates.len(), 1);
        assert_eq!(first.data, vec![0; REGION_SIZE as usize]);
        let generation = first.generations[0];

        let writer = state
            .exchange(
                REGION_SIZE,
                &[generation],
                &[range(0, 4, 0, 4)],
                &[0; 4],
                &[1, 2, 3, 4],
                false,
            )
            .unwrap();
        assert!(writer.updates.is_empty());
        assert!(writer.data.is_empty());

        let stale = state
            .exchange(
                REGION_SIZE,
                &[generation],
                &[range(0, 12, 0, 4)],
                &[0; 4],
                &[5, 6, 7, 8],
                false,
            )
            .unwrap();
        assert_ranges(&stale.updates, &[range(0, 4, 0, 4)]);
        assert_eq!(stale.data, vec![1, 2, 3, 4]);
    }

    #[test]
    fn conflicting_stale_range_is_atomic() {
        let state = FileState::default();
        let initial = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        let generation = initial.generations[0];
        state
            .exchange(
                REGION_SIZE,
                &[generation],
                &[range(0, 0, 0, 4)],
                &[0; 4],
                &[1; 4],
                false,
            )
            .unwrap();

        let error = state
            .exchange(
                REGION_SIZE,
                &[generation],
                &[range(0, 0, 0, 4), range(0, 8, 4, 4)],
                &[0; 8],
                &[2; 8],
                false,
            )
            .unwrap_err();
        assert!(matches!(error, ShmError::Conflict));

        let current = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], true)
            .unwrap();
        assert_eq!(&current.data[0..4], &[1; 4]);
        assert_eq!(&current.data[8..12], &[0; 4]);
    }

    #[test]
    fn committed_exchange_rejects_an_ambiguous_retry() {
        let state = FileState::default();
        let initial = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        let generation = initial.generations[0];
        let arguments = [range(0, 0, 0, 4)];
        state
            .exchange(
                REGION_SIZE,
                &[generation],
                &arguments,
                &[0; 4],
                &[9; 4],
                false,
            )
            .unwrap();
        let retried = state
            .exchange(
                REGION_SIZE,
                &[generation],
                &arguments,
                &[0; 4],
                &[9; 4],
                false,
            )
            .unwrap_err();
        assert!(matches!(retried, ShmError::Conflict));
    }

    #[test]
    fn published_epoch_tracks_only_committed_canonical_changes() {
        let state = FileState::default();
        assert_eq!(state.current_epoch(), 0);

        let initial = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        assert!(initial.epoch > 0);
        assert_eq!(state.current_epoch(), initial.epoch);

        let unchanged = state
            .exchange(
                REGION_SIZE,
                &initial.generations,
                &[range(0, 0, 0, 4)],
                &[0; 4],
                &[0; 4],
                false,
            )
            .unwrap();
        assert_eq!(unchanged.epoch, initial.epoch);
        assert_eq!(state.current_epoch(), initial.epoch);

        let changed = state
            .exchange(
                REGION_SIZE,
                &unchanged.generations,
                &[range(0, 0, 0, 4)],
                &[0; 4],
                &[1; 4],
                false,
            )
            .unwrap();
        assert!(changed.epoch > unchanged.epoch);
        assert_eq!(state.current_epoch(), changed.epoch);

        let conflict = state
            .exchange(
                REGION_SIZE,
                &initial.generations,
                &[range(0, 0, 0, 4)],
                &[0; 4],
                &[2; 4],
                false,
            )
            .unwrap_err();
        assert!(matches!(conflict, ShmError::Conflict));
        assert_eq!(state.current_epoch(), changed.epoch);
    }

    #[test]
    fn current_epoch_is_monotonic_during_concurrent_publish_and_reset() {
        let state = Arc::new(FileState::default());
        state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        let start = Arc::new(Barrier::new(4));
        let done = Arc::new(AtomicBool::new(false));

        let reader = {
            let state = Arc::clone(&state);
            let start = Arc::clone(&start);
            let done = Arc::clone(&done);
            thread::spawn(move || {
                start.wait();
                let mut previous = 0;
                while !done.load(Ordering::Acquire) {
                    let current = state.current_epoch();
                    assert!(current >= previous);
                    previous = current;
                    std::hint::spin_loop();
                }
                let current = state.current_epoch();
                assert!(current >= previous);
                current
            })
        };
        let publisher = {
            let state = Arc::clone(&state);
            let start = Arc::clone(&start);
            thread::spawn(move || {
                start.wait();
                for marker in 1..=64_u8 {
                    loop {
                        let snapshot = state
                            .exchange(REGION_SIZE, &[0], &[], &[], &[], true)
                            .unwrap();
                        let result = state.exchange(
                            REGION_SIZE,
                            &snapshot.generations,
                            &[range(0, 0, 0, 4)],
                            &snapshot.data[..4],
                            &[marker; 4],
                            false,
                        );
                        match result {
                            Ok(_) => break,
                            Err(ShmError::Conflict | ShmError::InvalidArgument) => continue,
                            Err(error) => panic!("unexpected publish error: {error:?}"),
                        }
                    }
                }
            })
        };
        let resetter = {
            let state = Arc::clone(&state);
            let start = Arc::clone(&start);
            thread::spawn(move || {
                start.wait();
                for _ in 0..64 {
                    state.reset().unwrap();
                }
            })
        };

        start.wait();
        publisher.join().unwrap();
        resetter.join().unwrap();
        done.store(true, Ordering::Release);
        let observed = reader.join().unwrap();
        assert_eq!(observed, state.current_epoch());
    }

    #[test]
    fn reset_invalidates_old_generations_and_zeroes_regions() {
        let state = FileState::default();
        let initial = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        state
            .exchange(
                REGION_SIZE,
                &initial.generations,
                &[range(0, 0, 0, 4)],
                &[0; 4],
                &[7; 4],
                false,
            )
            .unwrap();
        let before_reset_epoch = state.current_epoch();
        state.reset().unwrap();
        let reset_epoch = state.current_epoch();
        assert!(reset_epoch > before_reset_epoch);

        let reset = state
            .exchange(REGION_SIZE, &initial.generations, &[], &[], &[], false)
            .unwrap();
        assert_eq!(reset.epoch, state.current_epoch());
        assert!(reset.epoch >= reset_epoch);
        assert!(reset.generations[0] > initial.generations[0]);
        assert_eq!(reset.data, vec![0; REGION_SIZE as usize]);
    }

    #[test]
    fn old_generation_falls_back_to_full_region_after_history_is_trimmed() {
        let state = FileState::default();
        let initial = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        let mut generation = initial.generations[0];
        for value in 1..=MAX_HISTORY_GENERATIONS + 1 {
            let byte = u8::try_from(value).unwrap();
            let result = state
                .exchange(
                    REGION_SIZE,
                    &[generation],
                    &[range(0, 0, 0, 4)],
                    &[byte - 1; 4],
                    &[byte; 4],
                    false,
                )
                .unwrap();
            generation = result.generations[0];
        }

        let stale = state
            .exchange(REGION_SIZE, &initial.generations, &[], &[], &[], false)
            .unwrap();
        assert_ranges(&stale.updates, &[range(0, 0, 0, REGION_SIZE)]);
        assert_eq!(stale.data.len(), REGION_SIZE as usize);
    }

    #[test]
    fn merges_adjacent_and_overlapping_history_ranges() {
        let ranges = super::merge_byte_ranges(vec![
            ByteRange {
                offset: 8,
                length: 4,
            },
            ByteRange {
                offset: 0,
                length: 8,
            },
            ByteRange {
                offset: 4,
                length: 8,
            },
        ])
        .unwrap();
        assert_eq!(
            ranges,
            vec![ByteRange {
                offset: 0,
                length: 12
            }]
        );
    }

    #[test]
    fn registry_shares_live_state_and_expires_it_after_the_last_session() {
        let registry = Registry::default();
        let identity = FileIdentity {
            volume: 1,
            file_id_high: 2,
            file_id_low: 3,
        };
        let first = registry.state(identity).unwrap();
        let initial = first
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        first
            .exchange(
                REGION_SIZE,
                &initial.generations,
                &[range(0, 0, 0, 4)],
                &[0; 4],
                &[4; 4],
                false,
            )
            .unwrap();
        let second = registry.state(identity).unwrap();
        assert!(Arc::ptr_eq(&first, &second));
        let observed = second
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        assert_eq!(&observed.data[0..4], &[4; 4]);
        let expired = Arc::downgrade(&first);
        drop(first);
        drop(second);
        assert!(expired.upgrade().is_none());

        let replacement = registry.state(identity).unwrap();
        let reset = replacement
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        assert_eq!(reset.data, vec![0; REGION_SIZE as usize]);
    }

    #[test]
    fn registry_replaces_only_the_expired_exact_key() {
        let registry = Registry::default();
        let expired_identity = FileIdentity {
            volume: 1,
            file_id_high: 2,
            file_id_low: 3,
        };
        let other_identity = FileIdentity {
            volume: 65,
            ..expired_identity
        };
        assert_eq!(
            Registry::shard_index(expired_identity),
            Registry::shard_index(other_identity)
        );

        let expired_state = Arc::new(FileState::default());
        let expired = Arc::downgrade(&expired_state);
        registry.shards[Registry::shard_index(expired_identity)]
            .lock()
            .unwrap()
            .insert(expired_identity, expired.clone());
        drop(expired_state);

        let other = registry.state(other_identity).unwrap();
        assert!(expired.upgrade().is_none());
        assert!(registry.shards[Registry::shard_index(expired_identity)]
            .lock()
            .unwrap()
            .contains_key(&expired_identity));

        let replacement = registry.state(expired_identity).unwrap();
        let stored = registry.shards[Registry::shard_index(expired_identity)]
            .lock()
            .unwrap()
            .get(&expired_identity)
            .and_then(std::sync::Weak::upgrade)
            .unwrap();
        assert!(Arc::ptr_eq(&replacement, &stored));
        drop(other);
    }

    #[test]
    fn registry_cleanup_bounds_distinct_identity_churn() {
        let registry = Registry::default();

        for file_id_low in 0..4096 {
            let identity = FileIdentity {
                volume: 1,
                file_id_high: 2,
                file_id_low,
            };
            let state = registry.state(identity).unwrap();
            registry.remove_if_last(identity, &state);
            drop(state);
        }

        assert!(registry
            .shards
            .iter()
            .all(|shard| shard.lock().unwrap().is_empty()));
    }

    #[test]
    fn registry_cleanup_preserves_shared_or_replaced_state() {
        let registry = Registry::default();
        let identity = FileIdentity {
            volume: 1,
            file_id_high: 2,
            file_id_low: 3,
        };
        let state = registry.state(identity).unwrap();
        let other_session = Arc::clone(&state);
        registry.remove_if_last(identity, &state);
        assert!(registry.shards[Registry::shard_index(identity)]
            .lock()
            .unwrap()
            .contains_key(&identity));

        drop(other_session);
        let replacement = Arc::new(FileState::default());
        registry.shards[Registry::shard_index(identity)]
            .lock()
            .unwrap()
            .insert(identity, Arc::downgrade(&replacement));
        registry.remove_if_last(identity, &state);
        let registered = registry.shards[Registry::shard_index(identity)]
            .lock()
            .unwrap()
            .get(&identity)
            .and_then(Weak::upgrade)
            .unwrap();
        assert!(Arc::ptr_eq(&replacement, &registered));
    }

    #[test]
    fn all_current_clean_read_returns_without_ranges() {
        let state = FileState::default();
        let initial = state
            .exchange(REGION_SIZE, &[0, 0], &[], &[], &[], false)
            .unwrap();
        let current = state
            .exchange(
                REGION_SIZE,
                &initial.generations,
                &[range(0, 0, 0, 4)],
                &[0; 4],
                &[5; 4],
                false,
            )
            .unwrap();

        let unchanged = state
            .exchange(REGION_SIZE, &current.generations, &[], &[], &[], false)
            .unwrap();
        assert_eq!(unchanged.generations, current.generations);
        assert!(unchanged.updates.is_empty());
        assert!(unchanged.data.is_empty());

        let forced = state
            .exchange(REGION_SIZE, &unchanged.generations, &[], &[], &[], true)
            .unwrap();
        assert_eq!(forced.updates.len(), 2);
        assert_eq!(forced.data.len(), 2 * REGION_SIZE as usize);
    }

    #[test]
    fn a_caller_may_map_fewer_regions_than_an_existing_session() {
        let state = FileState::default();
        let two_regions = state
            .exchange(REGION_SIZE, &[0, 0], &[], &[], &[], false)
            .unwrap();
        assert_eq!(two_regions.generations.len(), 2);

        let region_one_changed = state
            .exchange(
                REGION_SIZE,
                &two_regions.generations,
                &[range(1, 0, 0, 4)],
                &[0; 4],
                &[7; 4],
                false,
            )
            .unwrap();
        assert!(region_one_changed.epoch > two_regions.epoch);

        let one_region = state
            .exchange(
                REGION_SIZE,
                &two_regions.generations[..1],
                &[],
                &[],
                &[],
                false,
            )
            .unwrap();
        assert_eq!(one_region.generations.len(), 1);
        assert!(one_region.updates.is_empty());
        assert_eq!(one_region.epoch, region_one_changed.epoch);
        assert_eq!(state.current_epoch(), one_region.epoch);
    }

    #[test]
    fn rejects_resource_limits_without_mutating_state() {
        let state = FileState::default();
        let too_many_regions = vec![0; MAX_REGIONS + 1];
        let error = state
            .exchange(REGION_SIZE, &too_many_regions, &[], &[], &[], false)
            .unwrap_err();
        assert!(matches!(error, ShmError::ResourceExhausted));

        let accepted = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        assert_eq!(accepted.generations.len(), 1);
        assert_eq!(accepted.data, vec![0; REGION_SIZE as usize]);
    }

    #[test]
    fn force_refresh_splits_around_local_dirty_ranges() {
        let state = FileState::default();
        let initial = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        let generation = initial.generations[0];
        let written = state
            .exchange(
                REGION_SIZE,
                &[generation],
                &[range(0, 8, 0, 4)],
                &[0; 4],
                &[9; 4],
                true,
            )
            .unwrap();
        assert_ranges(&written.updates, &[range(0, 0, 0, 8), range(0, 12, 8, 20)]);
        assert_eq!(written.data, vec![0; 28]);

        let observed = state
            .exchange(REGION_SIZE, &[generation], &[], &[], &[], false)
            .unwrap();
        assert_ranges(&observed.updates, &[range(0, 8, 0, 4)]);
        assert_eq!(observed.data, vec![9; 4]);
    }

    #[test]
    fn stale_refresh_can_protect_unpublished_ranges_without_committing_them() {
        let state = FileState::default();
        let initial = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], false)
            .unwrap();
        let remote = state
            .exchange(
                REGION_SIZE,
                &initial.generations,
                &[range(0, 8, 0, 4)],
                &[0; 4],
                &[9; 4],
                false,
            )
            .unwrap();

        // Sending baseline bytes as both expected and replacement protects
        // an unpublished local range while pulling disjoint host deltas.
        let preserved = state
            .exchange(
                REGION_SIZE,
                &initial.generations,
                &[range(0, 0, 0, 4)],
                &[0; 4],
                &[0; 4],
                false,
            )
            .unwrap();
        assert_eq!(preserved.epoch, remote.epoch);
        assert_ranges(&preserved.updates, &[range(0, 8, 0, 4)]);
        assert_eq!(preserved.data, vec![9; 4]);

        let before_publish = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], true)
            .unwrap();
        assert_eq!(&before_publish.data[0..4], &[0; 4]);
        assert_eq!(&before_publish.data[8..12], &[9; 4]);

        state
            .exchange(
                REGION_SIZE,
                &preserved.generations,
                &[range(0, 0, 0, 4)],
                &[0; 4],
                &[7; 4],
                false,
            )
            .unwrap();
        let published = state
            .exchange(REGION_SIZE, &[0], &[], &[], &[], true)
            .unwrap();
        assert_eq!(&published.data[0..4], &[7; 4]);
        assert_eq!(&published.data[8..12], &[9; 4]);
    }

    #[test]
    fn unknown_interleaved_generation_forces_a_full_refresh() {
        let state = FileState::default();
        let initial = state
            .exchange(REGION_SIZE, &[0, 0], &[], &[], &[], false)
            .unwrap();
        let region_zero = state
            .exchange(
                REGION_SIZE,
                &initial.generations,
                &[range(0, 0, 0, 4)],
                &[0; 4],
                &[3; 4],
                false,
            )
            .unwrap();
        assert!(region_zero.generations[0] > initial.generations[1]);

        let unknown_for_region_zero = initial.generations[1];
        let refreshed = state
            .exchange(
                REGION_SIZE,
                &[unknown_for_region_zero],
                &[],
                &[],
                &[],
                false,
            )
            .unwrap();
        assert_ranges(&refreshed.updates, &[range(0, 0, 0, REGION_SIZE)]);
        assert_eq!(&refreshed.data[0..4], &[3; 4]);
    }

    fn range(region: u32, offset: u32, data_offset: u32, length: u32) -> ShmRange {
        ShmRange {
            region,
            offset,
            data_offset,
            length,
        }
    }

    fn assert_ranges(actual: &[ShmRange], expected: &[ShmRange]) {
        assert_eq!(actual.len(), expected.len());
        for (actual, expected) in actual.iter().zip(expected) {
            assert_eq!(actual.region, expected.region);
            assert_eq!(actual.offset, expected.offset);
            assert_eq!(actual.data_offset, expected.data_offset);
            assert_eq!(actual.length, expected.length);
        }
    }
}
