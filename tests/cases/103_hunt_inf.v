module t; real z, r; integer i; reg [7:0] a;
initial begin
 z = 0.0;
 r = 1.0 / z; i = r; $display("%0d", i);
 r = 0.0 / z; a = r; $display("%0d", a);
 $display("%0d", $rtoi(1.0/z));
end endmodule
