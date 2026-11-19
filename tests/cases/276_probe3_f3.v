module t; reg [7:0] a; reg signed [7:0] s; reg [3:0] n; integer i;
initial begin a = 8'd5; s = -8'd5; n = 4'd9; i = 7;
$display("[%+d][%+d][%+d][%+d]", a, s, n, i);
a = 8'hxx; s = 8'hxx; n = 4'hz; i = 'bx;
$display("[%+d][%+d][%+d][%+d]", a, s, n, i);
$display("[%+3d][%+1d][%+0d][%-+6d][%+06d][%06d]", a, s, n, i, a, i);
$display("[%05.1f][%+05d][%05d]", 1.0/0.0, 8'd5, -8'sd5);
end endmodule
