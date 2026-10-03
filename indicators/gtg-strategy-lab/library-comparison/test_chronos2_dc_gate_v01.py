import unittest
from chronos2_dc_gate_v01 import gate_allow


class Chronos2GateTests(unittest.TestCase):
    def test_long_allow_only_above(self):
        self.assertTrue(gate_allow(1, 100.0, 100.1))
        self.assertFalse(gate_allow(1, 100.0, 100.0))
        self.assertFalse(gate_allow(1, 100.0, 99.9))

    def test_short_allow_only_below(self):
        self.assertTrue(gate_allow(-1, 100.0, 99.9))
        self.assertFalse(gate_allow(-1, 100.0, 100.0))
        self.assertFalse(gate_allow(-1, 100.0, 100.1))

    def test_bad_direction_rejected(self):
        with self.assertRaises(ValueError):
            gate_allow(0, 100.0, 101.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
