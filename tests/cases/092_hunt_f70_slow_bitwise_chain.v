module top;
  parameter N = 400;
  wire [N:0] c; reg a = 0; genvar i;
  assign c[0] = a;
  generate for (i = 0; i < N; i = i + 1) begin: g assign c[i+1] = ~c[i]; end endgenerate
  initial begin #1 $display("%b", c[N]); a = 1; #1 $display("%b", c[N]); end
endmodule
