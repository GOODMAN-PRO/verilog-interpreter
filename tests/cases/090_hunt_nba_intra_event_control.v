module t; reg clk = 0; reg [3:0] q = 0, d = 3;
initial begin
  q <= @(posedge clk) d;
  #1 d = 9; #1 clk = 1; #1 $display("%0d", q);
end
endmodule
