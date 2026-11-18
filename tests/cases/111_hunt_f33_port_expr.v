module m(.x(a), .y(b));
  input [3:0] a; output [3:0] b; assign b = a;
endmodule
module top; reg [3:0] a=5; wire [3:0] y; m u(.x(a), .y(y)); initial #1 $display("%0d", y); endmodule
