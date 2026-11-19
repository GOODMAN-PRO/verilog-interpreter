module t;
  parameter A = B + 1;
  parameter B = 2;
  initial $display("%0d %0d", A, B);
endmodule
