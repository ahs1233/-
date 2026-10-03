import unittest
from chronos2_dc_gate_v01 import gate_allow, CONTEXT, HORIZON, QUANTILES


class Chronos2DCGateTests(unittest.TestCase):
    def test_frozen_contract(self):
        self.assertEqual(CONTEXT, 256)
        self.assertEqual(HORIZON, 4)
        self.assertEqual(QUANTILES, [0.1,0.5,0.9])

    def test_long_gate(self):
        self.assertTrue(gate_allow(1, 2000.0, 2001.0))
        self.assertFalse(gate_allow(1, 2000.0, 2000.0))
        self.assertFalse(gate_allow(1, 2000.0, 1999.0))

    def test_short_gate(self):
        self.assertTrue(gate_allow(-1, 2000.0, 1999.0))
        self.assertFalse(gate_allow(-1, 2000.0, 2000.0))
        self.assertFalse(gate_allow(-1, 2000.0, 2001.0))


if __name__ == "__main__":
    unittest.main(verbosity=2)
