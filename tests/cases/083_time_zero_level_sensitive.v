module tb;
  wire [3:0] a = 4'd3; reg [3:0] y, z; reg clk = 1; reg [3:0] q = 5; integer n = 0;
  parameter P = 7;
  always @* y = a + 1;
  always @* z = q + P;
  always @(posedge clk) n = n + 1;
  initial begin #1 $display("y=%b z=%b n=%0d", y, z, n); $monitor("%0t q=%0d", $time, q); #1 q = 6; #1 q = 7; $finish; end
endmodule
