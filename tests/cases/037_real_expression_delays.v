`timescale 1ns/100ps
module tb;
  integer base;
  real fraction;
  initial begin
    base = 2;
    fraction = 0.25;
    $timeformat(-10, 0, " ticks", 0);
    $display("start time=%0d realtime=%0.1f stamp=%t", $time, $realtime, $realtime);
    #1.25;
    $display("literal time=%0d realtime=%0.1f stamp=%t", $time, $realtime, $realtime);
    #(fraction);
    $display("real time=%0d realtime=%0.1f stamp=%t", $time, $realtime, $realtime);
    #(base + 1);
    $display("expression time=%0d realtime=%0.1f stamp=%t", $time, $realtime, $realtime);
    #0;
    $display("zero time=%0d realtime=%0.1f", $time, $realtime);
    $finish;
  end
endmodule