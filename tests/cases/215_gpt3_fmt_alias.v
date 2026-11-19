module top;
  parameter F = "b=%b";
  localparam A = F;
  initial $display(A, 1'b1);
endmodule
