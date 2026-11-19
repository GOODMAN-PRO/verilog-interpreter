module top;
  wire [2:0] c; reg ci = 0;
  assign c[0] = ci;
  always @(c[2]) $display("%0t c=%b", $time, c);
  initial #5 $display("end %b", c);
endmodule
