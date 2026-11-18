module t; reg [31:0] s; initial begin $swriteh(s,8'd255); $display("[%s]",s); $swriteb(s,4'd5); $display("[%s]",s); $swriteo(s,8'd9); $display("[%s]",s); end endmodule
