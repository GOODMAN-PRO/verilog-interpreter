`timescale 1ns/1ps
module bus_driver(input enable, input [3:0] data, inout [3:0] bus);
  assign bus = enable ? data : 4'bzzzz;
endmodule
module tb;
  reg ea,eb;
  reg [3:0] a,b;
  wire [3:0] bus;
  bus_driver left(ea,a,bus);
  bus_driver right(.bus(bus),.data(b),.enable(eb));
  initial begin
    ea=0; eb=0; a=4'b1010; b=4'b1001;
    #1 $display("undriven %b",bus);
    ea=1;
    #1 $display("one %b",bus);
    eb=1;
    #1 $display("conflict %b",bus);
    b=a;
    #1 $display("agree %b",bus);
    a=4'bxz01; b=4'b1z0z;
    #1 $display("xz %b",bus);
    ea=0;
    #1 $display("released %b",bus);
    eb=1'bx;
    #1 $display("unknown-enable %b",bus);
    $finish;
  end
endmodule
