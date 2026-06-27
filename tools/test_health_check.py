#!/usr/bin/env python3
"""Tests for cross-platform health check fallbacks."""

import os
import sys
import unittest
from unittest.mock import patch, mock_open

sys.path.insert(0, os.path.dirname(__file__))

from health_check import (
    check_memory_usage,
    check_load_average,
    _check_memory_linux,
    _check_load_linux,
    MEMORY_THRESHOLD_WARNING,
    MEMORY_THRESHOLD_CRITICAL,
)


class TestCheckMemoryLinux(unittest.TestCase):
    def test_linux_meminfo_parses_correctly(self):
        meminfo_content = (
            "MemTotal:       16384000 kB\n"
            "MemAvailable:    8192000 kB\n"
            "MemFree:         4096000 kB\n"
        )
        with patch("builtins.open", mock_open(read_data=meminfo_content)):
            result = _check_memory_linux()
        self.assertIsNotNone(result)
        status, detail, pct = result
        self.assertEqual(status, "OK")
        self.assertIn("50.0% used", detail)

    def test_linux_meminfo_critical(self):
        meminfo_content = (
            "MemTotal:       16384000 kB\n"
            "MemAvailable:     819200 kB\n"
        )
        with patch("builtins.open", mock_open(read_data=meminfo_content)):
            result = _check_memory_linux()
        self.assertIsNotNone(result)
        status, detail, pct = result
        self.assertEqual(status, "CRITICAL")

    def test_linux_meminfo_file_missing(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            result = _check_memory_linux()
        self.assertIsNone(result)

    def test_fallback_when_proc_missing(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            result = check_memory_usage()
        self.assertIsNotNone(result)
        status, detail, pct = result
        self.assertIn(status, ("OK", "WARNING", "CRITICAL"))


class TestCheckLoadLinux(unittest.TestCase):
    def test_linux_loadavg_parses_correctly(self):
        loadavg_content = "1.50 2.00 3.00 1/400 12345\n"
        with patch("builtins.open", mock_open(read_data=loadavg_content)):
            result = _check_load_linux()
        self.assertIsNotNone(result)
        status, detail, load = result
        self.assertEqual(status, "OK")
        self.assertIn("Load: 1.5", detail)

    def test_linux_loadavg_critical(self):
        loadavg_content = "16.00 15.00 14.00 1/400 12345\n"
        with patch("builtins.open", mock_open(read_data=loadavg_content)):
            result = _check_load_linux()
        self.assertIsNotNone(result)
        status, detail, load = result
        self.assertEqual(status, "CRITICAL")

    def test_linux_loadavg_file_missing(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            result = _check_load_linux()
        self.assertIsNone(result)

    def test_fallback_when_proc_missing(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            with patch("os.getloadavg", return_value=(2.0, 3.0, 4.0)):
                result = check_load_average()
        self.assertIsNotNone(result)
        status, detail, load = result
        self.assertIn(status, ("OK", "WARNING", "CRITICAL"))
        self.assertIn("Load: 2.0", detail)


class TestCheckMemoryPsutil(unittest.TestCase):
    def test_psutil_fallback(self):
        mock_mem = unittest.mock.MagicMock()
        mock_mem.percent = 45.0
        mock_mem.used = 7 * 1024 ** 3
        mock_mem.total = 16 * 1024 ** 3

        with patch("builtins.open", side_effect=FileNotFoundError):
            with patch.dict("sys.modules", {"psutil": unittest.mock.MagicMock(psutil=unittest.mock.MagicMock(virtual_memory=mock_mem))}):
                import importlib
                import health_check
                original = health_check._check_memory_psutil
                health_check._check_memory_psutil = lambda: ("OK", "45.0% used (7.0GB/16.0GB)", 45.0)
                try:
                    result = check_memory_usage()
                    self.assertEqual(result[0], "OK")
                finally:
                    health_check._check_memory_psutil = original


class TestCheckLoadGetloadavg(unittest.TestCase):
    def test_getloadavg_fallback(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            with patch("os.getloadavg", return_value=(1.0, 2.0, 3.0)):
                result = check_load_average()
        self.assertIsNotNone(result)
        status, detail, load = result
        self.assertIn(status, ("OK", "WARNING", "CRITICAL"))
        self.assertIn("Load: 1.0", detail)

    def test_getloadavg_critical(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            with patch("os.getloadavg", return_value=(20.0, 18.0, 16.0)):
                result = check_load_average()
        self.assertEqual(result[0], "CRITICAL")


class TestBackwardCompatibility(unittest.TestCase):
    def test_json_output_format(self):
        meminfo_content = (
            "MemTotal:       16384000 kB\n"
            "MemAvailable:    8192000 kB\n"
        )
        with patch("builtins.open", mock_open(read_data=meminfo_content)):
            status, detail, pct = check_memory_usage()
        self.assertIsInstance(pct, float)
        self.assertGreaterEqual(pct, 0)
        self.assertLessEqual(pct, 100)

    def test_load_returns_float(self):
        loadavg_content = "1.50 2.00 3.00 1/400 12345\n"
        with patch("builtins.open", mock_open(read_data=loadavg_content)):
            status, detail, load = check_load_average()
        self.assertIsInstance(load, float)
        self.assertGreaterEqual(load, 0)


if __name__ == "__main__":
    unittest.main()
