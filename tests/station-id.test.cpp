// Compile with Transmissor and Receptor as the include path, one sketch at a time.
#include "StationId.h"

static_assert(isValidStationId("station1", 8), "Default station");
static_assert(isValidStationId("aZ0_-", 5), "All allowed character groups");
static_assert(isValidStationId("a", 1), "One-character identifier");
static_assert(isValidStationId("abcdefghijklmnopqrstuvwx", 24), "Maximum length");
static_assert(!isValidStationId("abcdefghijklmnopqrstuvwxy", 25), "Too long");
static_assert(!isValidStationId("", 0), "Empty identifier");
static_assert(!isValidStationId(nullptr, 1), "Missing identifier");
static_assert(!isValidStationId("station 1", 9), "Space");
static_assert(!isValidStationId("station.1", 9), "Punctuation");
static_assert(!isValidStationId("station\n", 8), "Line feed");
static_assert(!isValidStationId("station\0x", 9), "Embedded null");
static_assert(!isValidStationId("\xc3\xa7", 2), "Non-ASCII letter");
