import unittest

import build


class BuildLoggingTests(unittest.TestCase):
    def test_format_command_quotes_arguments(self):
        self.assertEqual(
            build.format_command(["python3", "script with space.py", "--flag"]),
            "python3 'script with space.py' --flag",
        )

    def test_command_diagnostic_includes_command_context(self):
        module = build.Module(
            name="sample",
            language="Python",
            dir=build.ROOT / "tools",
            build_cmd=["python3", "tool.py"],
            clean_cmd=["true"],
        )

        output = build.command_diagnostic(
            module,
            ["python3", "tool.py"],
            7,
            "hello\n",
            "warning\n",
        )

        self.assertIn("cwd: tools", output)
        self.assertIn("command: python3 tool.py", output)
        self.assertIn("exit_code: 7", output)
        self.assertIn("--- stdout ---\nhello", output)
        self.assertIn("--- stderr ---\nwarning", output)

    def test_command_error_diagnostic_includes_missing_tool_context(self):
        module = build.Module(
            name="sample",
            language="Python",
            dir=build.ROOT / "tools",
            build_cmd=["missing-tool"],
            clean_cmd=["true"],
        )

        output = build.command_error_diagnostic(
            module,
            ["missing-tool", "--version"],
            FileNotFoundError("missing-tool"),
        )

        self.assertIn("cwd: tools", output)
        self.assertIn("command: missing-tool --version", output)
        self.assertIn("exit_code: command-not-started", output)
        self.assertIn("error: missing-tool", output)


if __name__ == "__main__":
    unittest.main()
