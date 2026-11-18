`timescale 1ns/1ps
module tb;
  reg [7:0] u;
  reg signed [7:0] s;
  reg [63:0] wide;
  integer i;
  real r;
  initial begin
    u=8'hfe; s=-7; wide=64'h1_0000_0000;
    $display("casts %0d %0d %0d %0d",u,$signed(u),s,$unsigned(s));
    $display("widths %0d %0d %0d %0d",$bits(u),$bits(s+u),$bits({u,s}),$bits(wide));
    for(i=0;i<=9;i=i+1)
      $display("clog2 %0d=%0d",i,$clog2(i));
    $display("clog2-wide %0d",$clog2(wide));
    r=3.9; i=r;
    $display("real-pos cast=%0d assign=%0d itor=%.1f",$rtoi(r),i,$itor(i));
    r=-3.9; i=r;
    $display("real-neg cast=%0d assign=%0d itor=%.1f",$rtoi(r),i,$itor(i));
    u=8'bx101zz00;
    $display("xz-casts %b %b",$signed(u),$unsigned(u));
    $finish;
  end
endmodule
