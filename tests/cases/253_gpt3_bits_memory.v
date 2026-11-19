module top;
  reg [2:0] m[0:3];
  initial $display("%0d", $bits(m));
endmodule
