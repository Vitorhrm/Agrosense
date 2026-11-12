#include "ProvisioningSettings.h"

static_assert(validWifiPassword("", 0), "Open Wi-Fi");
static_assert(!validWifiPassword("short", 5), "Minimum WPA passphrase length");
static_assert(validWifiPassword("password", 8), "Valid WPA passphrase");
static_assert(!validWifiPassword("abc\0defg", 8), "Reject embedded NUL");
static_assert(validWifiPassword("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", 64),
              "Raw PSK in hex");
static_assert(!validWifiPassword("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg", 64),
              "Reject non-hex raw PSK");
static_assert(!validProvisioningText("a\nb", 3), "Reject line breaks");
static_assert(validProvisioningText("\xc3\xa7", 2), "Allow UTF-8 device names");
