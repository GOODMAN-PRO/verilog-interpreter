module child; assign w=1'b0; endmodule
module top;
  wire w=1'b1;
  child c();
  initial #1 $display("%b",w);
endmodule
