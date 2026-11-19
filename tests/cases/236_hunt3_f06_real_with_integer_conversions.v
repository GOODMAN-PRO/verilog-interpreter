module t;
initial begin
$display("[%c][%5c]", 65.2, 66.9);
$display("[%+d]", 2.5);
$display("[%10h][%-6h][%08h]", 255.5, 255.5, 255.5);
$display("[%8b][%6o]", 5.5, 100.5);
end endmodule
