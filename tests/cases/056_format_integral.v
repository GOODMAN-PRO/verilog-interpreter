`timescale 1ns/1ps
module tb;
  reg signed [7:0] s;
  reg [11:0] v;
  integer n;
  initial begin
    s=-5; v=12'hab3; n=-123;
    $display("decimal |%d|%0d|%5d| signed |%d|%0d|%5d|",v,v,v,s,s,s);
    $display("bases %b %h %x %o signed %b %h %o",v,v,v,v,s,s,s);
    $display("integer |%d|%0d|%5d|",n,n,n);
    v=12'bxxzz_1010_01xz;
    $display("mixed %d %0d %5d %b %h %x %o",v,v,v,v,v,v,v);
    v=12'bxxxxxxxxxxxx;
    $display("all-x %d %0d %5d %b %h %o",v,v,v,v,v,v);
    v=12'bzzzzzzzzzzzz;
    $display("all-z %d %0d %5d %b %h %o",v,v,v,v,v,v);
    s=8'bx1111111;
    $display("signed-x |%d|%0d|%5d|",s,s,s);
    $display("character <%c><%c> percent=%%",8'd65,8'd122);
    $finish;
  end
endmodule
