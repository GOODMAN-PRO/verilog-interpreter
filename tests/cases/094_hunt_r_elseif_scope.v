module top; parameter A = 3;
  if (A == 1) begin: x wire [3:0] w = 1; end
  else if (A == 2) begin: y wire [3:0] w = 2; end
  else begin: z wire [3:0] w = 3; end
  initial #1 $display("%0d %m", z.w);
endmodule
