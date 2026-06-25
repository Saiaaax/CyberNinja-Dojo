import unittest

import build


class ModuleSelectionTests(unittest.TestCase):
    def module_names(self, modules):
        return [module.name for module in modules]

    def test_all_selects_every_module(self):
        selected, invalid = build.validate_module_selection(" all ")

        self.assertEqual(self.module_names(selected), self.module_names(build.MODULES))
        self.assertEqual(invalid, [])

    def test_comma_separated_selection_is_validated(self):
        selected, invalid = build.validate_module_selection("backend, frontend")

        self.assertEqual(self.module_names(selected), ["backend", "frontend"])
        self.assertEqual(invalid, [])

    def test_duplicate_module_names_are_selected_once(self):
        selected, invalid = build.validate_module_selection("backend,backend")

        self.assertEqual(self.module_names(selected), ["backend"])
        self.assertEqual(invalid, [])

    def test_unknown_module_is_reported(self):
        selected, invalid = build.validate_module_selection("backend,missing")

        self.assertEqual(self.module_names(selected), ["backend"])
        self.assertEqual(invalid, ["missing"])

    def test_empty_selection_token_is_reported(self):
        selected, invalid = build.validate_module_selection("backend,,frontend")

        self.assertEqual(self.module_names(selected), ["backend", "frontend"])
        self.assertEqual(invalid, ["<empty>"])


if __name__ == "__main__":
    unittest.main()
