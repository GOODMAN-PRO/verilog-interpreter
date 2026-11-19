module t; genvar i; wire [2999:0] w;
  generate for (i=0;i<3000;i=i+1) begin: a assign w[i] = 1; end endgenerate
  initial #1 $display("%b", &w);
endmodule
