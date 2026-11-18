module top; triand a; assign a = 1; assign a = 1'bz; initial #1 $display("%b", a); endmodule
