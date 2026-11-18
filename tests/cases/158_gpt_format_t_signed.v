`timescale 1ns/1ns
module top;
  initial begin $timeformat(-9,0,"",0); $display("%t",-2); end
endmodule
