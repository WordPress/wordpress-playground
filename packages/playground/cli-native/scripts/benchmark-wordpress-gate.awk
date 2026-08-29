BEGIN {
	FS = "\t";
	route_metrics_text = "home_p50_ms home_p95_ms search_p50_ms search_p95_ms post_p50_ms post_p95_ms editor_p50_ms editor_p95_ms";
	route_metric_count = split(route_metrics_text, route_metrics, " ");
}

FNR == 1 {
	for (column = 1; column <= NF; column++) {
		headers[column] = $column;
	}
	next;
}

FILENAME == baseline_file && $1 == baseline_label {
	found_baseline = 1;
	for (column = 2; column <= NF; column++) {
		baseline[headers[column]] = $column;
	}
	next;
}

FILENAME != baseline_file && $1 == wasm_label {
	found_wasm = 1;
	for (column = 2; column <= NF; column++) {
		wasm[headers[column]] = $column;
	}
	next;
}

FILENAME != baseline_file && $1 == native_label {
	found_native = 1;
	for (column = 2; column <= NF; column++) {
		native[headers[column]] = $column;
	}
	next;
}

END {
	if (!found_baseline) {
		printf "error: baseline label `%s` not found in %s\n", baseline_label, baseline_file > "/dev/stderr";
		exit 1;
	}
	if (!found_wasm) {
		printf "error: candidate label `%s` not found in benchmark results\n", wasm_label > "/dev/stderr";
		exit 1;
	}
	if (!found_native) {
		printf "error: native label `%s` not found in benchmark results\n", native_label > "/dev/stderr";
		exit 1;
	}

	print "";
	print "benchmark_gate";
	print "metric\tactual\tlimit\tbaseline\tdelta\tallowed_delta\tpass";

	check_limit("burst_rss_mib", wasm["burst_rss_mib"], max_burst_rss_mib, "", "", "");
	check_idle_rss_ratio(wasm["idle_rss_mib"], native["idle_rss_mib"], max_idle_rss_ratio);

	for (route_index = 1; route_index <= route_metric_count; route_index++) {
		metric = route_metrics[route_index];
		actual = number(wasm[metric], metric);
		base = number(baseline[metric], metric);
		allowed = max(max_route_regression_ms + 0, base * (max_route_regression_pct + 0) / 100);
		limit = base + allowed;
		delta = actual - base;
		pass = delta <= allowed;
		printf "%s\t%.3f\t%.3f\t%.3f\t%.3f\t%.3f\t%d\n", metric, actual, limit, base, delta, allowed, pass;
		if (!pass) {
			printf "benchmark gate failure: %s actual=%.3f limit=%.3f baseline=%.3f allowed_delta=%.3f\n", metric, actual, limit, base, allowed > "/dev/stderr";
			failed = 1;
		}
	}

	print_idle_rss_diagnostics();

	exit failed ? 1 : 0;
}

function check_idle_rss_ratio(actual_text, native_text, ratio_limit_text, actual, native_idle, ratio_limit, ratio, limit, delta, allowed, pass, failure) {
	actual = number(actual_text, "post-suite retained-worker idle RSS");
	native_idle = positive_number(native_text, "native idle RSS");
	ratio_limit = configured_positive_number(ratio_limit_text, "max idle RSS ratio", "1.3");
	ratio = actual / native_idle;
	limit = native_idle * ratio_limit;
	delta = actual - native_idle;
	allowed = limit - native_idle;
	pass = actual <= limit;

	printf "%s\t%.3f\t%.3f\t%.3f\t%.3f\t%.3f\t%d\n", "post_suite_retained_worker_idle_rss_mib", actual, limit, native_idle, delta, allowed, pass;

	idle_actual_rss_mib = actual;
	idle_native_rss_mib = native_idle;
	idle_actual_ratio = ratio;
	idle_selected_ratio_limit = ratio_limit;

	if (!pass) {
		failure = "benchmark gate failure: post-suite retained-worker idle RSS";
		printf "%s actual=%.3f limit=%.3f native_idle=%.3f actual_ratio=%.3fx selected_ratio_limit=%.3fx\n", failure, actual, limit, native_idle, ratio, ratio_limit > "/dev/stderr";
		failed = 1;
	}
}

function print_idle_rss_diagnostics() {
	print "";
	print "retained_worker_idle_rss_diagnostics";
	print "metric\tactual_ratio\tselected_limit\tlimit_1.2x_mib\tpass_1.2x\tlimit_1.3x_mib\tpass_1.3x";
	printf "%s\t%.3fx\t%.3fx\t%.3f\t%d\t%.3f\t%d\n", "post_suite_retained_worker_idle_rss", idle_actual_ratio, idle_selected_ratio_limit, idle_native_rss_mib * 1.2, idle_actual_rss_mib <= idle_native_rss_mib * 1.2, idle_native_rss_mib * 1.3, idle_actual_rss_mib <= idle_native_rss_mib * 1.3;
	print "note\tidle RSS is sampled after the route suite with a retained worker";
	print "note\tthis is not a post-recycle or cold-idle native equality check";
}

function check_limit(metric, actual_text, limit_text, baseline_text, delta_text, allowed_text, actual, limit, pass) {
	actual = number(actual_text, metric);
	limit = number(limit_text, metric " limit");
	pass = actual <= limit;
	printf "%s\t%.3f\t%.3f\t%s\t%s\t%s\t%d\n", metric, actual, limit, baseline_text, delta_text, allowed_text, pass;
	if (!pass) {
		printf "benchmark gate failure: %s actual=%.3f limit=%.3f\n", metric, actual, limit > "/dev/stderr";
		failed = 1;
	}
}

function number(value, label) {
	if (value == "" || value !~ /^[-]?[0-9]+([.][0-9]+)?$/) {
		printf "error: %s is missing or not numeric: `%s`\n", label, value > "/dev/stderr";
		exit 1;
	}
	return value + 0;
}

function configured_positive_number(value, label, default_value) {
	if (value == "") {
		value = default_value;
	}
	return positive_number(value, label);
}

function positive_number(value, label, result) {
	result = number(value, label);
	if (result <= 0) {
		printf "error: %s must be greater than zero: `%s`\n", label, value > "/dev/stderr";
		exit 1;
	}
	return result;
}

function max(left, right) {
	return left > right ? left : right;
}
