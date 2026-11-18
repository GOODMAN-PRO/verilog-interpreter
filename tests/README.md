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
| [085_hunt_automatic_task_recursion_clobbers_args](cases/085_hunt_automatic_task_recursion_clobbers_args.v) | Automatic tasks are not re-entrant. |
| [086_hunt_a1](cases/086_hunt_a1.v) | Automatic tasks share one static copy of arguments and locals (concurrent calls and recursion). |
| [087_hunt_lost](cases/087_hunt_lost.v) | A change a process makes to its own wake-up net through a continuous assign is lost. |
| [088_hunt_pow](cases/088_hunt_pow.v) | ** takes its signedness from both operands; Icarus uses the base only. |
| [089_hunt_zp](cases/089_hunt_zp.v) | Zero-padded %0Nd of a negative number puts the zeros before the minus sign. |
| [090_hunt_nba_intra_event_control](cases/090_hunt_nba_intra_event_control.v) | Nonblocking assignment with intra-assignment event control rejected. |
| [091_hunt_hier_ref_task_local](cases/091_hunt_hier_ref_task_local.v) | Hierarchical reference into a task or function scope rejected. |
| [092_hunt_f70_slow_bitwise_chain](cases/092_hunt_f70_slow_bitwise_chain.v) | Chain of per-bit continuous assigns into one vector (400 bits) is cubic and times out. |
| [093_hunt_x14_inout_vec](cases/093_hunt_x14_inout_vec.v) | Inout port connected to a bit/part select of a wire is rejected. |
| [094_hunt_r_elseif_scope](cases/094_hunt_r_elseif_scope.v) | else-if in a conditional generate creates an extra genblk scope. |
| [095_hunt_r_pullup_gates](cases/095_hunt_r_pullup_gates.v) | pullup/pulldown/nmos/pmos/cmos/tran primitives fail with a confusing parse error. |
| [096_hunt_sd_zero_neg](cases/096_hunt_sd_zero_neg.v) | %05d / %010d on negative values puts zeros before the minus sign. |
| [097_hunt_real_round_half](cases/097_hunt_real_round_half.v) | %f %e %g round exact ties up; C printf rounds ties to even. |
| [098_hunt_pu](cases/098_hunt_pu.v) | pullup/pulldown and switch primitives (nmos, pmos, tran) give a useless error. |
| [099_hunt_half](cases/099_hunt_half.v) | %f/%e/%g round exact ties half-up instead of half-to-even. |
| [100_hunt_big](cases/100_hunt_big.v) | %f prints values >= 1e21 in exponent form and loses requested digits. |
| [101_hunt_rad](cases/101_hunt_rad.v) | %b, %o, %h of a real print decimal instead of the rounded integer in that radix. |
| [102_hunt_rx](cases/102_hunt_rx.v) | A vector with x/z bits converted to real becomes 0.0. |
| [103_hunt_inf](cases/103_hunt_inf.v) | Real infinity or NaN assigned to an integer or reg gives 0; Icarus gives x. |
| [104_hunt_nz](cases/104_hunt_nz.v) | Negative zero loses its sign in %f/%e/%g. |
| [105_hunt_str_line_continuation](cases/105_hunt_str_line_continuation.v) | A backslash-newline inside a string is not a line continuation (and line numbers go off by one). |
| [106_hunt_up](cases/106_hunt_up.v) | %E and %G print a lowercase 'e'. |
| [107_hunt_static_function_recursion_shared](cases/107_hunt_static_function_recursion_shared.v) | Static (non-automatic) recursive function behaves as automatic. |
| [108_hunt_disable_forward_named_block](cases/108_hunt_disable_forward_named_block.v) | disable of a named block declared later in the same process is reported as 'not declared'. |
| [109_hunt_fmt_left_justify_t_c](cases/109_hunt_fmt_left_justify_t_c.v) | Field width and left-justify flag ignored for %t and %c. |
| [110_hunt_r_triand_decl](cases/110_hunt_r_triand_decl.v) | triand/trior/trireg declarations give a misleading parse error. |
| [111_hunt_f33_port_expr](cases/111_hunt_f33_port_expr.v) | Explicit named ports in the module header `module m(.x(a), .y(b))` not parsed. |
| [112_hunt_r_task_local_via_taskname](cases/112_hunt_r_task_local_via_taskname.v) | Hierarchical reference to a task/function local via the task or function name is rejected. |
| [113_hunt_f12_ifdef_skipped_quote](cases/113_hunt_f12_ifdef_skipped_quote.v) | `ifdef-skipped text with an unbalanced double quote produces a lexer error. |
| [114_hunt_zeropad_bho](cases/114_hunt_zeropad_bho.v) | Zero flag is ignored for %h %o and %s (only %b and %d honour it). |
| [115_hunt_fixed_big](cases/115_hunt_fixed_big.v) | %f (and %t) of values >= 1e21 print JS exponent notation instead of full digits. |
| [116_hunt_real_hex](cases/116_hunt_real_hex.v) | %h / %b / %o of a real print the decimal value instead of converting the rounded integer. |
| [117_hunt_swriteh](cases/117_hunt_swriteh.v) | $swriteh / $swriteb / $swriteo are rejected as unsupported system tasks (also $printtimescale). |
| [118_hunt_timeformat_var](cases/118_hunt_timeformat_var.v) | $timeformat rejects non-constant arguments, and a negative precision or width crashes with a misleading 'internal limit exceeded'. |
| [119_hunt_monitor_glitch](cases/119_hunt_monitor_glitch.v) | $monitor does not fire when an argument changes and returns to its old value within one time step. |
| [120_hunt_real_e_upper](cases/120_hunt_real_e_upper.v) | %E and %G upper-case specifiers print lower-case exponent. |
| [121_hunt_fmt_width_ct_m](cases/121_hunt_fmt_width_ct_m.v) | Width and left-justify ignored for %-t, %Nc and %Nm. |
| [122_hunt_mon](cases/122_hunt_mon.v) | $monitoron does not display the monitor line immediately. |
| [123_hunt_dis](cases/123_hunt_dis.v) | Forward `disable name` of a block declared later says the block is not declared. |
| [124_hunt_esc](cases/124_hunt_esc.v) | %5c ignores the field width; \xHH string escape is not recognised. |
| [125_gpt_ca_masked_change](cases/125_gpt_ca_masked_change.v) | An unchanged RHS postpones an inertial transition. |
| [126_gpt_vector_x_delay](cases/126_gpt_vector_x_delay.v) | A partially unknown vector uses the wrong transition delay. |
| [127_gpt_inout_range](cases/127_gpt_inout_range.v) | An inout port adopts the parent's indexing and signedness. |
| [128_gpt_star_param_index](cases/128_gpt_star_param_index.v) | A variable index into a parameter disappears from inferred sensitivity. |
| [129_gpt_wired_kinds](cases/129_gpt_wired_kinds.v) | Unsupported wired and pulled net declarations silently use wire semantics. |
| [130_gpt_implicit_parent_net](cases/130_gpt_implicit_parent_net.v) | A child’s implicit wire drives a same-named wire in its parent. |
| [131_gpt_auto_task](cases/131_gpt_auto_task.v) | Overlapping automatic task calls overwrite each other’s inputs. |
| [132_gpt_auto_func](cases/132_gpt_auto_func.v) | Function storage lifetime ignores automatic and static declarations. |
| [133_gpt_param_select](cases/133_gpt_param_select.v) | Bit selection discards a parameter’s declared range. |
| [134_gpt_const_call_state](cases/134_gpt_const_call_state.v) | Constant function evaluation changes later simulation results. |
| [135_gpt_power_sign](cases/135_gpt_power_sign.v) | An unsigned exponent incorrectly zero-extends a signed base. |
| [136_gpt_resetall](cases/136_gpt_resetall.v) | `resetall` leaves the previous time scale active. |
| [137_gpt_monitor_resample](cases/137_gpt_monitor_resample.v) | `$monitor` loses pulses and the first sample after `$monitoron`. |
| [138_gpt_sformat_variable](cases/138_gpt_sformat_variable.v) | `$sformat` treats a register-held format string as a number. |
| [139_gpt_timeformat_runtime](cases/139_gpt_timeformat_runtime.v) | `$timeformat` evaluates its arguments before the calling process runs. |
| [140_gpt_macro_commented_comma](cases/140_gpt_macro_commented_comma.v) | A comma inside a comment splits a macro argument. |
| [141_gpt_inout_select](cases/141_gpt_inout_select.v) | Legal constant bit-selects cannot connect an inout port. |
| [142_gpt_forward_hier_inout](cases/142_gpt_forward_hier_inout.v) | An inout cannot reference an explicitly named net declared later. |
| [143_gpt_nba_event_capture](cases/143_gpt_nba_event_capture.v) | Event-controlled nonblocking assignments are rejected. |
| [144_gpt_deferred_net_implicit](cases/144_gpt_deferred_net_implicit.v) | An implicit LHS net can be invisible to another process in the same module. |
| [145_gpt_const_func_io](cases/145_gpt_const_func_io.v) | A system task inside a constant function emits output during elaboration. |
| [146_gpt_forward_function](cases/146_gpt_forward_function.v) | A constant cannot call a function declared later in the module. |
| [147_gpt_static_task_local](cases/147_gpt_static_task_local.v) | Legal hierarchical reads of static task variables fail. |
| [148_gpt_static_block_forward](cases/148_gpt_static_block_forward.v) | A hierarchical reference to a later named procedural block fails. |
| [149_gpt_gen_direct_nesting](cases/149_gpt_gen_direct_nesting.v) | Directly nested conditional generates introduce an extra hierarchy level. |
| [150_gpt_gen_collision](cases/150_gpt_gen_collision.v) | An implicit generate-block name can reject an otherwise legal design. |
| [151_gpt_nonansi_alias](cases/151_gpt_nonansi_alias.v) | A non-ANSI port cannot expose an internal signal under another name. |
| [152_gpt_real_convert_x](cases/152_gpt_real_convert_x.v) | Converting a vector to real discards every known bit when one bit is X or Z. |
| [153_gpt_ternary_real](cases/153_gpt_ternary_real.v) | An unknown condition selects the false branch of a real conditional. |
| [154_gpt_zero_replication](cases/154_gpt_zero_replication.v) | A legal zero replication inside a nonempty concatenation is rejected. |
| [155_gpt_real_fmtflags](cases/155_gpt_real_fmtflags.v) | Real display formatting drops the C plus flag. |
| [156_gpt_sys_temporal](cases/156_gpt_sys_temporal.v) | `$printtimescale` cannot report the current module’s time scale. |
| [157_gpt_dist_uniform](cases/157_gpt_dist_uniform.v) | `$dist_uniform` rejects a standard seeded distribution call. |
| [158_gpt_format_t_signed](cases/158_gpt_format_t_signed.v) | `%t` renders a negative integral argument as a large positive time. |
| [159_gpt_gen_counter](cases/159_gpt_gen_counter.v) | Named generate loops do not consume their implicit-name ordinal. |
| [160_dis](cases/160_dis.v) | disable across processes, named fork as a timeout, concurrent automatic tasks. |
| [161_hunt2_d](cases/161_hunt2_d.v) | Function declared with a reg return type (function reg [3:0] f, function reg f) is rejected. |
| [162_hunt2_a](cases/162_hunt2_a.v) | Automatic function: locals in a named block inside the function are not saved per recursion level. |
| [163_hunt2_b](cases/163_hunt2_b.v) | Automatic function: local memory (array) is not saved per recursion level. |
| [164_hunt2_c](cases/164_hunt2_c.v) | disable of an automatic task or block terminates only the current activation; Icarus terminates all activations. |
| [165_hunt2_e02_dn_wor](cases/165_hunt2_e02_dn_wor.v) | `default_nettype wand/wor/tri0/tri1 ignored: implicit nets are always plain wires. |
| [166_hunt2_g01_cfunc_static_rec](cases/166_hunt2_g01_cfunc_static_rec.v) | Recursive non-automatic function evaluated in a constant context uses static storage. |
| [167_hunt2_f07_string_parameter_display](cases/167_hunt2_f07_string_parameter_display.v) | String parameter used as $display argument or format is printed as a number. |
| [168_hunt2_f2](cases/168_hunt2_f2.v) | Legal finite zero-delay loop of more than 10M iterations is rejected as 'stuck at time 0'. |
| [169_hunt2_t01](cases/169_hunt2_t01.v) | inout port connected to a concatenation of nets is rejected. |
| [170_hunt2_r03](cases/170_hunt2_r03.v) | Undriven bits read x instead of z until a delayed driver of the same net first fires; unfired delayed drivers contribute z instead of x. |
| [171_hunt2_e](cases/171_hunt2_e.v) | Hierarchical name task.block fails to resolve when the task is automatic. |
| [172_hunt2_c01_param_before_use_mod](cases/172_hunt2_c01_param_before_use_mod.v) | Parameters used before their declaration are rejected in constant contexts. |
| [173_hunt2_f01_plus_zero_flag](cases/173_hunt2_f01_plus_zero_flag.v) | + flag with 0 flag puts sign after zero padding in %f/%e/%g. |
| [174_hunt2_f02_zero_flag_inf_nan](cases/174_hunt2_f02_zero_flag_inf_nan.v) | Zero flag pads inf/nan with zeros. |
| [175_hunt2_f06_printtimescale_scope_arg](cases/175_hunt2_f06_printtimescale_scope_arg.v) | $printtimescale(scope) ignores its argument. |
| [176_hunt2_big](cases/176_hunt2_big.v) | Huge %d width gives misleading 'nested or recursing too deeply' error. |
| [177_hunt2_f6](cases/177_hunt2_f6.v) | `default_nettype wand/wor is ignored for implicit nets. |
| [178_gpt2_param_const_finish](cases/178_gpt2_param_const_finish.v) | A constant function containing `$finish` throws out of `Verilog.run`. |
| [179_gpt2_const_fn_shared](cases/179_gpt2_const_fn_shared.v) | One parameter's constant-function call supplies the next call's local state. |
| [180_gpt2_default_kind](cases/180_gpt2_default_kind.v) | The active default net kind is lost on an implicit wire. |
| [181_gpt2_wand_child](cases/181_gpt2_wand_child.v) | A wired inout loses its resolver when connected to an ordinary wire. |
| [182_gpt2_tri1_child](cases/182_gpt2_tri1_child.v) | A tri1 inout fails to pull the connected bus high. |
| [183_gpt2_delayed_initial_driver](cases/183_gpt2_delayed_initial_driver.v) | A pending delayed driver contributes Z until its first update. |
| [184_gpt2_pull_conflict](cases/184_gpt2_pull_conflict.v) | Reversing opposing pulls changes the settled wire value. |
| [185_gpt2_wand_pull](cases/185_gpt2_wand_pull.v) | Pulldown and pullup are ignored on an actively driven wired net. |
| [186_gpt2_nmos_z](cases/186_gpt2_nmos_z.v) | An enabled MOS transistor turns a floating source into X. |
| [187_gpt2_disable_recursive_task](cases/187_gpt2_disable_recursive_task.v) | Disabling a recursive task from another process aborts the simulation. |
| [188_gpt2_automatic_local_storage](cases/188_gpt2_automatic_local_storage.v) | Automatic memories and named-block locals retain values across invocations. |
| [189_gpt2_disable_auto_named_two_calls](cases/189_gpt2_disable_auto_named_two_calls.v) | Disabling a named block in an automatic task leaves another active copy running. |
| [190_gpt2_star_wait_condition](cases/190_gpt2_star_wait_condition.v) | A wait condition is absent from an enclosing always @* sensitivity list. |
| [191_gpt2_imp_call_arg](cases/191_gpt2_imp_call_arg.v) | An implicit port-connection net disappears inside a function argument. |
| [192_gpt2_shadow_implicit](cases/192_gpt2_shadow_implicit.v) | An ancestor task prevents creation of an unrelated local net. |
| [193_gpt2_default_none_forward](cases/193_gpt2_default_none_forward.v) | An explicit declaration later in the module is mistaken for an implicit net. |
| [194_gpt2_inout_concat](cases/194_gpt2_inout_concat.v) | A legal concatenation cannot connect an inout port. |
| [195_gpt2_inout_array_word](cases/195_gpt2_inout_array_word.v) | An inout rejects a constant-indexed word of a net array. |
| [196_gpt2_rng_signedness](cases/196_gpt2_rng_signedness.v) | Unsigned bit patterns bypass signed integer conversion in $dist_uniform. |
| [197_gpt2_fmt_ts_arg](cases/197_gpt2_fmt_ts_arg.v) | $printtimescale ignores the requested module instance. |
| [198_gpt2_display_stringparam](cases/198_gpt2_display_stringparam.v) | A string-valued parameter is printed as decimal instead of being used as a display format. |
| [199_gpt2_fmt_bareprecision](cases/199_gpt2_fmt_bareprecision.v) | A bare precision dot is printed literally in valid real conversions. |
| [200_gpt2_signed_finite_specials](cases/200_gpt2_signed_finite_specials.v) | Real zero-padding displaces a positive sign and pads infinities with zeroes. |
| [201_gpt2_fmt_empty_char](cases/201_gpt2_fmt_empty_char.v) | A null display operand disappears when consumed by a format conversion. |
| [202_gpt2_fmt_zero_other](cases/202_gpt2_fmt_zero_other.v) | Zero-filled %c and %t fields receive spaces. |
| [203_g1](cases/203_g1.v) | inout ports through two levels of hierarchy with pullup, pulldown and tri1. |
| [204_tasks_fork_disable_mix](cases/204_tasks_fork_disable_mix.v) | Automatic recursion with memories, a named fork used as a timeout, disable across processes, event-controlled nonblocking assignment. |
