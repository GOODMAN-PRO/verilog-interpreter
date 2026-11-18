module first;
  initial #1 $display("first");
endmodule
`timescale 1us/1us
`resetall
module second;
  initial #2 $display("second");
endmodule
