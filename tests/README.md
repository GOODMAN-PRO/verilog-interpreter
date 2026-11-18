| Case | What it exercises |
| --- | --- |
| [001_integer_literals](cases/001_integer_literals.v) | Sized/unsized bases, separators, x/z/? digits. |
| [002_signed_literals](cases/002_signed_literals.v) | Signed literals, unary negation, sign extension. |
| [003_strings_comments](cases/003_strings_comments.v) | Packed strings, escapes, truncation, comments. |
| [004_macros_conditionals](cases/004_macros_conditionals.v) | Object/function macros and nested conditional directives. |
| [005_timescale_delays](cases/005_timescale_delays.v) | Timescale precision and fractional delay rounding. |
| [006_scalar_types](cases/006_scalar_types.v) | Type defaults/values/widths; Icarus $bits(real) extension. |
| [007_vector_ranges](cases/007_vector_ranges.v) | Descending, ascending and offset vector ranges. |
| [008_memories](cases/008_memories.v) | One- and two-dimensional reg memories. |
| [009_parameters](cases/009_parameters.v) | Typed parameters, localparams and constant sizing. |
| [010_arithmetic](cases/010_arithmetic.v) | Arithmetic, signed division/remainder, powers and unary signs. |
| [011_bitwise_four_state](cases/011_bitwise_four_state.v) | Four-state bitwise operations. |
| [012_reductions](cases/012_reductions.v) | All reductions with known, x and z bits. |
| [013_logical_relational](cases/013_logical_relational.v) | Logical truth, signed/unsigned comparisons, unknowns. |
| [014_equality](cases/014_equality.v) | Logical versus case equality and inequality. |
| [015_shifts](cases/015_shifts.v) | Logical/arithmetic shifts, oversized and unknown amounts. |
| [016_conditional_four_state](cases/016_conditional_four_state.v) | Conditional selection and bitwise x/z branch merging. |
| [017_concatenation_replication](cases/017_concatenation_replication.v) | Nested concatenations, replication and concatenation lvalues. |
| [018_constant_selects](cases/018_constant_selects.v) | Bit/constant part-selects across range directions. |
| [019_indexed_selects](cases/019_indexed_selects.v) | +:/-: reads and writes on ascending/descending/offset vectors. |
| [020_memory_word_selects](cases/020_memory_word_selects.v) | Memory-word bit, constant and indexed part-selects. |
| [021_unknown_out_of_range_selects](cases/021_unknown_out_of_range_selects.v) | Invalid/unknown indices, partial reads and ignored writes. |
| [022_carry_and_shifted_sum](cases/022_carry_and_shifted_sum.v) | Carry capture and context-sized sums before shifts. |
| [023_context_self_determined_width](cases/023_context_self_determined_width.v) | Context versus self sizing in products, powers and shifts. |
| [024_mixed_signed_unsigned](cases/024_mixed_signed_unsigned.v) | Mixed signedness in arithmetic, comparisons and equality. |
| [025_assignment_extension](cases/025_assignment_extension.v) | Sign/zero extension; selects/concatenations lose signedness. |
| [026_unsized_wide_contexts](cases/026_unsized_wide_contexts.v) | Unsized constants in wide contexts (IEEE 32-bit rules only; the Icarus lossless-unsized quirk is left out). |
| [027_signed_unsigned_functions](cases/027_signed_unsigned_functions.v) | $signed/$unsigned widths, extension, comparisons and shifts. |
| [028_arithmetic_unknown_zero](cases/028_arithmetic_unknown_zero.v) | x/z arithmetic, division/modulo by zero and power corners. |
| [029_real_arithmetic_conversions](cases/029_real_arithmetic_conversions.v) | Real arithmetic, rounding, truncation and conversions. |
| [030_conditional_comparison_context](cases/030_conditional_comparison_context.v) | Conditional/comparison operand widths and signedness. |
| [031_blocking_nba_order](cases/031_blocking_nba_order.v) | Blocking/NBA swaps, #0 region and ordered NBA writes. |
| [032_nba_selects_memory](cases/032_nba_selects_memory.v) | Ordered NBA bit/part/word writes and captured indices. |
| [033_blocking_intra_delay](cases/033_blocking_intra_delay.v) | Blocking intra-assignment RHS capture and delayed lvalues. |
| [034_nba_intra_delay](cases/034_nba_intra_delay.v) | Delayed NBAs capture source values and destination indices. |
| [035_sensitivity_forms](cases/035_sensitivity_forms.v) | Level, or/comma and wildcard sensitivity lists. |
| [036_four_state_edges](cases/036_four_state_edges.v) | Positive/negative edge classification through x/z. |
| [037_real_expression_delays](cases/037_real_expression_delays.v) | Integer, real and expression delay controls. |
| [038_wait_event_control](cases/038_wait_event_control.v) | wait with false/x/true conditions and edge event controls. |
| [039_if_exact_case](cases/039_if_exact_case.v) | if truth and exact four-state case matching. |
| [040_casez_casex_priority](cases/040_casez_casex_priority.v) | Wildcard cases, overlapping matches and priority. |
| [041_loop_controls](cases/041_loop_controls.v) | for/while/repeat/forever, captured repeat count and zero iterations. |
| [042_named_block_disable](cases/042_named_block_disable.v) | Named-block locals and break/continue-style disable. |
| [043_fork_join_named_events](cases/043_fork_join_named_events.v) | Concurrent branches, join, named event triggering/waiting. |
| [044_function_headers](cases/044_function_headers.v) | Old-style/ANSI functions and signed arguments/results. |
| [045_automatic_recursion](cases/045_automatic_recursion.v) | Automatic recursive functions with independent locals. |
| [046_constant_functions](cases/046_constant_functions.v) | Constant functions in parameters and vector bounds. |
| [047_task_arguments](cases/047_task_arguments.v) | Input/output/inout task arguments and module state. |
| [048_task_timing_controls](cases/048_task_timing_controls.v) | Tasks with delays, edge controls and copy-out timing. |
| [049_disable_current_task](cases/049_disable_current_task.v) | Early task return with disable and output copy-out. |
| [050_display_strobe_regions](cases/050_display_strobe_regions.v) | Active/inactive/NBA output versus end-of-step strobe. |
| [051_ports_parameters_hierarchy](cases/051_ports_parameters_hierarchy.v) | Positional/named ports and overrides, open ports, hierarchical access/tasks. |
| [052_generate_branches](cases/052_generate_branches.v) | genvar loops, generate if/case and named scopes. |
| [053_gate_primitives](cases/053_gate_primitives.v) | Twelve logic/buffer/inverter primitives with x/z controls. |
| [054_continuous_inertial_delay](cases/054_continuous_inertial_delay.v) | Wire declaration assignments, inertial and rise/fall delays. |
| [055_tristate_inout_resolution](cases/055_tristate_inout_resolution.v) | Plain-wire inout buses, floating drivers, agreement and conflicts. |
| [056_format_integral](cases/056_format_integral.v) | Decimal padding, bases, signed/x/z values, characters and percent. |
| [057_format_real_scope_string](cases/057_format_real_scope_string.v) | e/f/g precision, string fields, %m and formatted time. |
| [058_display_write_variants](cases/058_display_write_variants.v) | Default formatting, display/write b/h/o variants and partial lines. |
| [059_strobe_scheduling_variants](cases/059_strobe_scheduling_variants.v) | Strobe b/h/o variants observe NBA results. |
| [060_monitor_variants](cases/060_monitor_variants.v) | Monitor coalescing, replacement, b/h/o variants and on/off. |
| [061_time_rounding_timescale](cases/061_time_rounding_timescale.v) | $time/$stime/$realtime, $timeformat and 32-bit time wrap. |
| [062_numeric_system_functions](cases/062_numeric_system_functions.v) | $signed/$unsigned/$clog2/$bits/$rtoi/$itor. |
| [063_sformat_packed_strings](cases/063_sformat_packed_strings.v) | $sformat, packed-string truncation, escapes and scope. |
| [064_signed_ports_and_net_selects](cases/064_signed_ports_and_net_selects.v) | Signed port extension and continuous selected net drivers. |
| [065_counter](cases/065_counter.v) | Asynchronous reset, enable, up/down counting and wraparound. |
| [066_shift_register](cases/066_shift_register.v) | Load/hold, left/right shifting and serial data. |
| [067_lfsr](cases/067_lfsr.v) | Deterministic feedback sequence, enable and reset. |
| [068_gray_code](cases/068_gray_code.v) | Binary/Gray conversion and counter wraparound. |
| [069_moore_fsm](cases/069_moore_fsm.v) | Moore state transitions and state-based output. |
| [070_mealy_fsm](cases/070_mealy_fsm.v) | Mealy output changes between active clock edges. |
| [071_alu](cases/071_alu.v) | Arithmetic/logic, carry/borrow, signed shifts/comparisons and unknowns. |
| [072_ripple_adder](cases/072_ripple_adder.v) | Generated full-adder chain and carry propagation. |
| [073_priority_encoder](cases/073_priority_encoder.v) | Priority, validity, multiple requests and x/z inputs. |
| [074_barrel_shifter](cases/074_barrel_shifter.v) | Generated logical shifts/rotations in both directions and boundary amounts. |
| [075_synchronous_fifo](cases/075_synchronous_fifo.v) | FIFO wrap, full/empty boundaries and simultaneous operations. |
| [076_single_port_ram](cases/076_single_port_ram.v) | Synchronous read-before-write RAM, enable and unknown addresses. |
| [077_clock_divider](cases/077_clock_divider.v) | Clock division, tick pulses, output phase and reset. |
| [078_debouncer](cases/078_debouncer.v) | Short bounce rejection and stable input qualification. |
| [079_uart_transmitter](cases/079_uart_transmitter.v) | Serial start/data/stop timing and busy-start rejection. |
| [080_sequence_detector](cases/080_sequence_detector.v) | Overlapping serial sequence detection and reset. |
| [081_accumulator_cpu](cases/081_accumulator_cpu.v) | Instruction ROM, arithmetic, conditional branch loop and halt. |
| [082_round_robin_arbiter](cases/082_round_robin_arbiter.v) | Rotating grant priority, request patterns and acceptance gating. |
| [083_time_zero_level_sensitive](cases/083_time_zero_level_sensitive.v) | Level-sensitive always blocks see constants, parameters and initialisers at time 0. |
| [084_time_zero_edge_sensitive](cases/084_time_zero_edge_sensitive.v) | A declaration initialiser is not an edge for an edge-triggered always block. |
