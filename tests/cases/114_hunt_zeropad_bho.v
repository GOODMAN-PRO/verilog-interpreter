module t; reg [7:0] a; initial begin a=8'd5; $display("[%08b][%06o][%06h][%04h]", a,a,a,a); end endmodule
