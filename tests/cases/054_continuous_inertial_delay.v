`timescale 1ns/1ps
module tb;
  reg a,b;
  wire immediate = a ^ b;
  wire delayed, asymmetric;
  assign #2 delayed = a;
  assign #(2,3) asymmetric = b;
  initial begin
    a=0; b=0;
    #4 $display("settled %b%b%b",immediate,delayed,asymmetric);
    a=1; b=1;
    #1 $display("pending %b%b%b",immediate,delayed,asymmetric);
    a=0;
    #3 $display("pulse-rejected %b%b%b",immediate,delayed,asymmetric);
    a=1; b=0;
    #1 $display("pending2 %b%b%b",immediate,delayed,asymmetric);
    #1.5 $display("rise-first %b%b%b",immediate,delayed,asymmetric);
    #1 $display("fall-later %b%b%b",immediate,delayed,asymmetric);
    a=1'bx;
    #3 $display("unknown %b%b%b",immediate,delayed,asymmetric);
    $finish;
  end
endmodule
