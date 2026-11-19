module top;
  localparam A = B + 1;
  localparam B = 4;
  initial $display(A, B);
endmodule
