`timescale 10ns/1ns
module tb;
  integer ticks;
  real step;
  initial begin
    ticks = 2;
    step = 0.26;
    $timeformat(-9, 1, " ns", 0);
    $display("start t=%t rt=%0.2f", $time, $realtime);
    #0.14;
    $display("round1 t=%t rt=%0.2f", $time, $realtime);
    #0.16;
    $display("round2 t=%t rt=%0.2f", $time, $realtime);
    #(step);
    $display("real t=%t rt=%0.2f", $time, $realtime);
    #(ticks + 1);
    $display("expr t=%t rt=%0.2f st=%0d", $time, $realtime, $stime);
    $finish;
  end
endmodule
