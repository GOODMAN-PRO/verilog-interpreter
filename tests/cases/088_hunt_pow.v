module t; reg [3:0] ub; reg signed [7:0] s8; reg signed [3:0] sb;
initial begin
 ub = 4'd3; s8 = -8'sd5; sb = 4'sd3;
 $display("%0d", s8 ** ub);
 $display("%0d", s8 ** sb);
 $display("%0d", s8 ** ub < 0);
 $display("%0d", (-2) ** ub);
 $display("%0d", s8 << ub);
end endmodule
