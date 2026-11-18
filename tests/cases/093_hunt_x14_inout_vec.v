module t(inout [3:0] io, input [3:0] d, input oe); assign io = oe ? d : 4'bzzzz; endmodule
module top; wire [7:0] w; reg [3:0] d; reg oe;
 t u(w[3:0], d, oe);
 initial begin d=4'h9; oe=1; #1 $display("%h", w); end endmodule
