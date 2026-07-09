#include "string_score.h"

uint32_t string_score_weighted_sum(const char *input, size_t length)
{
	uint32_t score = 0;

	for (size_t i = 0; i < length; i++) {
		score += ((uint32_t) (unsigned char) input[i]) * (uint32_t) (i + 1);
	}

	return score;
}
