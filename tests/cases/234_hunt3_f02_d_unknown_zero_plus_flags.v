module t; reg [7:0] a;
initial begin a = 8'hxx;
$display("[%05d]", a);
$display("[%+d]", a);
$display("[%+5d]", 8'hzz);
end endmodule
