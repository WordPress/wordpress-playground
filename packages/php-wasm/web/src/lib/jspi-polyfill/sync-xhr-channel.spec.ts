import { sendSyncXhr } from './sync-xhr-channel';

let mockXhr: {
	open: ReturnType<typeof vi.fn>;
	send: ReturnType<typeof vi.fn>;
	status: number;
	response: ArrayBuffer | null;
	responseType: string;
};

beforeEach(() => {
	mockXhr = {
		open: vi.fn(),
		send: vi.fn(),
		status: 200,
		response: new ArrayBuffer(0),
		responseType: '',
	};
	(globalThis as any).XMLHttpRequest = vi.fn(() => mockXhr);
});

afterEach(() => {
	delete (globalThis as any).XMLHttpRequest;
});

describe('sendSyncXhr', () => {
	it('opens a synchronous POST to /_jspi/<path>', () => {
		sendSyncXhr('sleep', { ms: 100 });
		expect(mockXhr.open).toHaveBeenCalledWith(
			'POST',
			'/_jspi/sleep?ms=100',
			false
		);
	});

	it('sets responseType to arraybuffer', () => {
		sendSyncXhr('fetch');
		expect(mockXhr.responseType).toBe('arraybuffer');
	});

	it('sends the body when provided', () => {
		const body = new Uint8Array([1, 2, 3]);
		sendSyncXhr('msg', {}, body);
		expect(mockXhr.send).toHaveBeenCalledWith(body);
	});

	it('sends without body when none provided', () => {
		sendSyncXhr('sleep');
		expect(mockXhr.send).toHaveBeenCalledWith();
	});

	it('returns ok: true with data on 2xx status', () => {
		const data = new Uint8Array([10, 20]).buffer;
		mockXhr.status = 200;
		mockXhr.response = data;

		const result = sendSyncXhr('fetch');
		expect(result.ok).toBe(true);
		expect(result.data).toEqual(new Uint8Array([10, 20]));
	});

	it('returns ok: false on non-2xx status', () => {
		mockXhr.status = 500;
		mockXhr.response = new ArrayBuffer(0);

		const result = sendSyncXhr('sock-open');
		expect(result.ok).toBe(false);
		expect(result.data).toEqual(new Uint8Array(0));
	});

	it('returns ok: false when send() throws NetworkError', () => {
		mockXhr.send = vi.fn(() => {
			throw new DOMException('NetworkError');
		});

		const result = sendSyncXhr('sleep');
		expect(result.ok).toBe(false);
		expect(result.data).toEqual(new Uint8Array(0));
	});

	it('builds query string from params', () => {
		sendSyncXhr('sock-recv', { socketId: 5, maxSize: 1024 });
		expect(mockXhr.open).toHaveBeenCalledWith(
			'POST',
			'/_jspi/sock-recv?socketId=5&maxSize=1024',
			false
		);
	});

	it('omits query string when no params', () => {
		sendSyncXhr('fetch');
		expect(mockXhr.open).toHaveBeenCalledWith(
			'POST',
			'/_jspi/fetch',
			false
		);
	});
});
