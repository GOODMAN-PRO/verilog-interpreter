`define PU pull1
`unconnected_drive `PU
module s(input a, output b); assign b = a; endmodule
`nounconnected_drive
module t; wire b; s u(.b(b)); initial #1 $display("%b", b); endmodule
