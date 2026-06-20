package.preload["periphery"] = function()
    return {
        I2C = function()
            error("I2C should not be opened by checksum tests")
        end,
    }
end

package.preload["crypto"] = function()
    return {
        cmac = function()
            return string.rep(string.char(0), 16)
        end,
    }
end

bit = {
    band = function(value, mask)
        if mask == 0xFF then
            return value % 0x100
        end
        return value % (mask + 1)
    end,
}

local NFC = dofile("scanner.lua")
local helper = NFC._test

local function assert_eq(actual, expected, label)
    if actual ~= expected then
        error(string.format("%s: expected %s, got %s", label, tostring(expected), tostring(actual)), 2)
    end
end

local function assert_truthy(value, label)
    if not value then
        error(label, 2)
    end
    return value
end

local function corrupt_byte(data, index)
    local current = assert_truthy(data:byte(index), "corrupt index must exist")
    return data:sub(1, index - 1) .. string.char((current + 1) % 0x100) .. data:sub(index + 1)
end

local function expected_dcs(payload)
    return helper.data_checksum(string.char(0xD4) .. payload)
end

local short_payload = string.char(0x02)
local short_frame = assert_truthy(helper.build_frame(short_payload), "short frame builds")
assert_eq(short_frame, string.char(0x00, 0x00, 0xFF, 0x02, 0xFE, 0xD4, 0x02, 0x2A, 0x00),
          "short frame bytes")

local parsed = assert_truthy(helper.parse_frame(short_frame), "short frame parses")
assert_eq(parsed.extended, false, "short frame is normal")
assert_eq(parsed.length, 2, "short frame length includes TFI")
assert_eq(parsed.tfi, 0xD4, "short frame TFI")
assert_eq(parsed.payload, short_payload, "short frame payload")
assert_eq(short_frame:byte(8), expected_dcs(short_payload), "short DCS")

local boundary_payload = string.char(0x40) .. string.rep(string.char(0xAA), 253)
local boundary_frame = assert_truthy(helper.build_frame(boundary_payload), "boundary frame builds")
parsed = assert_truthy(helper.parse_frame(boundary_frame), "boundary frame parses")
assert_eq(parsed.extended, false, "255-byte content still uses normal frame")
assert_eq(parsed.length, 0xFF, "boundary frame content length")
assert_eq(parsed.payload, boundary_payload, "boundary payload preserved")
assert_eq(boundary_frame:byte(4), 0xFF, "boundary normal LEN")
assert_eq(boundary_frame:byte(5), 0x01, "boundary normal LCS")

local long_payload = string.char(0x40) .. string.rep(string.char(0x55), 299)
local long_frame = assert_truthy(helper.build_frame(long_payload), "long frame builds")
parsed = assert_truthy(helper.parse_frame(long_frame), "long frame parses")
assert_eq(parsed.extended, true, "long frame uses extended format")
assert_eq(parsed.length, #long_payload + 1, "long frame content length")
assert_eq(parsed.payload, long_payload, "long payload preserved")
assert_eq(long_frame:byte(4), 0xFF, "extended marker byte 1")
assert_eq(long_frame:byte(5), 0xFF, "extended marker byte 2")
assert_eq(long_frame:byte(6), math.floor((#long_payload + 1) / 0x100), "extended length high")
assert_eq(long_frame:byte(7), (#long_payload + 1) % 0x100, "extended length low")
assert_eq(bit.band(long_frame:byte(6) + long_frame:byte(7) + long_frame:byte(8), 0xFF),
          0, "extended length checksum")

local dcs_index = 9 + (#long_payload + 1)
assert_eq(long_frame:byte(dcs_index), expected_dcs(long_payload), "long DCS")

local bad_data_checksum, data_err = helper.parse_frame(corrupt_byte(long_frame, dcs_index))
assert_eq(bad_data_checksum, nil, "corrupted DCS is rejected")
assert_truthy(data_err and data_err:match("data checksum"), "corrupted DCS has clear error")

local bad_length_checksum, length_err = helper.parse_frame(corrupt_byte(boundary_frame, 5))
assert_eq(bad_length_checksum, nil, "corrupted LCS is rejected")
assert_truthy(length_err and length_err:match("length checksum"), "corrupted LCS has clear error")

print("nfc scanner checksum tests passed")
