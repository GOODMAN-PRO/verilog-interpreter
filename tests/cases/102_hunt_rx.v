module t; real r; reg [3:0] v;
initial begin
 v = 4'b1x01; r = v; $display("%f", r);
 v = 4'b1z01; r = v; $display("%f", r);
end endmodule
