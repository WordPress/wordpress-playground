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
	check_limit("idle_rss_mib", wasm["idle_rss_mib"], native["idle_rss_mib"], "", "", "");

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

	exit failed ? 1 : 0;
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

function max(left, right) {
	return left > right ? left : right;
}
