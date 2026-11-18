`timescale 1ns/1ps
module tb;
  reg a,b,en;
  wire [11:0] y;
  integer i;
  and   g0(y[0],a,b);
  or    g1(y[1],a,b);
  nand  g2(y[2],a,b);
  nor   g3(y[3],a,b);
  xor   g4(y[4],a,b);
  xnor  g5(y[5],a,b);
  not   g6(y[6],a);
  buf   g7(y[7],a);
  bufif0 g8(y[8],a,en);
  bufif1 g9(y[9],a,en);
  notif0 g10(y[10],a,en);
  notif1 g11(y[11],a,en);
  initial begin
    for(i=0;i<8;i=i+1) begin
      {en,a,b}=i;
      #1 $display("g en=%b a=%b b=%b y=%b",en,a,b,y);
    end
    en=1'bx; a=0; b=1'bx;
    #1 $display("g en=%b a=%b b=%b y=%b",en,a,b,y);
    en=1'bz; a=1; b=1'bz;
    #1 $display("g en=%b a=%b b=%b y=%b",en,a,b,y);
    en=0; a=1'bz; b=0;
    #1 $display("g en=%b a=%b b=%b y=%b",en,a,b,y);
    en=1; a=1'bx; b=1;
    #1 $display("g en=%b a=%b b=%b y=%b",en,a,b,y);
    $finish;
  end
endmodule
