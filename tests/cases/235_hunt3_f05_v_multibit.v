module t; wire [3:0] w = 4'b10z1; reg [2:0] r = 3'b101;
initial begin #1; $display("[%v]", w); $display("[%v]", r); end
endmodule
