# Synthetic SFX analysis

48 kHz mono PCM16 exports; measurements before quantization and mix bus. RMS150 uses a fixed 150 ms window (short sounds zero-padded). Full-buffer FFT power; phone=500–8000 Hz. Peak time=start of loudest sliding 1 ms power window. These are synthetic, not recordings; human ear-check required.

| name | dur s | peak dBFS | RMS150 dBFS | phone % | 2–8k % | peak ms |
|---|---:|---:|---:|---:|---:|---:|
| synth_wax_crack_1 | 0.090 | -3.10 | -21.00 | 95.7 | 93.6 | 0.17 |
| synth_wax_crack_2 | 0.090 | -3.10 | -21.00 | 95.1 | 94.3 | 0.46 |
| synth_wax_crack_3 | 0.090 | -3.10 | -21.00 | 96.7 | 93.9 | 0.06 |
| synth_wax_break_1 | 0.220 | -3.10 | -19.00 | 98.0 | 81.1 | 0.27 |
| synth_wax_break_2 | 0.220 | -3.10 | -19.00 | 94.8 | 80.9 | 0.04 |
| synth_wax_break_3 | 0.220 | -3.10 | -19.00 | 94.2 | 71.1 | 0.06 |
| synth_wax_kill_1 | 0.390 | -3.10 | -19.00 | 95.0 | 74.8 | 0.19 |
| synth_wax_kill_2 | 0.390 | -3.10 | -19.00 | 93.2 | 62.7 | 0.21 |
| synth_wax_kill_3 | 0.390 | -3.10 | -19.00 | 94.0 | 77.7 | 0.44 |
| synth_bubble_pop_1 | 0.075 | -3.10 | -21.00 | 91.8 | 46.6 | 0.02 |
| synth_bubble_pop_2 | 0.075 | -3.10 | -21.00 | 93.9 | 70.6 | 0.17 |
| synth_bubble_pop_3 | 0.075 | -3.10 | -21.00 | 93.5 | 90.0 | 0.02 |
| synth_jelly_wobble_1 | 0.300 | -4.98 | -21.00 | 92.4 | 52.1 | 1.08 |
| synth_jelly_wobble_2 | 0.300 | -3.28 | -21.00 | 96.4 | 85.8 | 0.83 |
| synth_jelly_wobble_3 | 0.300 | -3.57 | -21.00 | 91.8 | 62.4 | 0.73 |
| synth_jelly_splat_1 | 0.250 | -4.17 | -19.00 | 91.0 | 52.2 | 2.77 |
| synth_jelly_splat_2 | 0.250 | -3.60 | -19.00 | 93.1 | 62.2 | 0.40 |
| synth_jelly_splat_3 | 0.250 | -3.28 | -19.00 | 93.2 | 64.6 | 0.69 |
| synth_ice_crack_1 | 0.240 | -3.13 | -21.00 | 98.0 | 97.9 | 0.56 |
| synth_ice_crack_2 | 0.240 | -3.10 | -21.00 | 97.3 | 97.2 | 0.13 |
| synth_ice_crack_3 | 0.240 | -3.12 | -21.00 | 98.8 | 98.3 | 0.13 |
| synth_ice_shatter_1 | 0.660 | -3.95 | -19.00 | 99.2 | 98.7 | 0.04 |
| synth_ice_shatter_2 | 0.660 | -3.12 | -19.00 | 98.3 | 98.3 | 0.21 |
| synth_ice_shatter_3 | 0.660 | -3.18 | -19.00 | 99.0 | 98.6 | 0.38 |
| synth_squish_creak_1 | 1.200 | -12.32 | -26.00 | 89.7 | 43.8 | 411.06 |
| synth_squish_creak_2 | 1.200 | -12.88 | -26.00 | 89.7 | 42.9 | 308.52 |
| synth_squish_creak_3 | 1.200 | -13.60 | -26.00 | 89.6 | 42.7 | 297.40 |
| synth_squish_pop_1 | 0.440 | -3.67 | -19.00 | 67.6 | 46.3 | 0.94 |
| synth_squish_pop_2 | 0.440 | -3.47 | -19.00 | 65.8 | 46.9 | 0.77 |
| synth_squish_pop_3 | 0.440 | -3.86 | -19.00 | 67.7 | 47.2 | 1.46 |
| synth_boss_layer_1_1 | 0.360 | -3.11 | -19.00 | 95.6 | 57.7 | 0.13 |
| synth_boss_layer_1_2 | 0.360 | -3.10 | -19.00 | 95.5 | 62.2 | 0.04 |
| synth_boss_layer_1_3 | 0.360 | -3.10 | -19.00 | 95.5 | 67.8 | 0.48 |
| synth_boss_layer_2_1 | 0.430 | -3.10 | -19.00 | 94.8 | 64.9 | 0.23 |
| synth_boss_layer_2_2 | 0.430 | -3.15 | -19.00 | 97.1 | 53.9 | 0.33 |
| synth_boss_layer_2_3 | 0.430 | -3.10 | -19.00 | 94.4 | 75.0 | 0.06 |
| synth_boss_layer_3_1 | 0.510 | -3.10 | -19.00 | 94.9 | 52.4 | 0.52 |
| synth_boss_layer_3_2 | 0.510 | -3.10 | -19.00 | 93.2 | 65.0 | 0.13 |
| synth_boss_layer_3_3 | 0.510 | -3.14 | -19.00 | 95.9 | 53.8 | 1.00 |
| synth_boss_core_1 | 0.360 | -3.44 | -21.00 | 95.6 | 77.5 | 0.85 |
| synth_boss_core_2 | 0.360 | -6.18 | -21.00 | 90.3 | 56.0 | 3.92 |
| synth_boss_core_3 | 0.360 | -3.54 | -21.00 | 93.9 | 70.7 | 0.90 |
| synth_boss_final_1 | 1.500 | -5.33 | -17.00 | 99.0 | 6.1 | 0.88 |
| synth_boss_final_2 | 1.500 | -3.47 | -17.00 | 99.1 | 10.8 | 0.73 |
| synth_boss_final_3 | 1.500 | -3.45 | -17.00 | 99.1 | 12.6 | 1.02 |
| synth_slash_finisher_1 | 0.650 | -13.92 | -24.00 | 100.0 | 25.0 | 35.79 |
| synth_slash_finisher_2 | 0.650 | -14.11 | -24.00 | 100.0 | 24.5 | 104.73 |
| synth_slash_finisher_3 | 0.650 | -14.27 | -24.00 | 100.0 | 25.1 | 71.21 |
| synth_boss_thud_1 | 0.240 | -3.24 | -21.00 | 87.6 | 54.1 | 0.83 |
| synth_boss_thud_2 | 0.240 | -5.24 | -21.00 | 75.5 | 4.6 | 2.96 |
| synth_boss_thud_3 | 0.240 | -4.87 | -21.00 | 76.9 | 10.4 | 3.04 |
