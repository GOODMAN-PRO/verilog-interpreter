`timescale 1ns/1ps
module signed_path(input signed [7:0] a, output signed [15:0] y);
  assign y=a;
endmodule
module sliced_path(input [7:0] a, output [15:0] y);
  assign y=a[7:0];
endmodule
module tb;
  reg signed [7:0] source;
  wire signed [15:0] extended;
  wire [15:0] sliced;
  wire [7:0] assembled;
  wire [0:7] ascending;
  signed_path sign(source,extended);
  sliced_path slice(source,sliced);
  assign assembled[7:4]=source[3:0];
  assign assembled[3:0]=source[7:4];
  assign ascending=source;
  initial begin
    source=-5;
    #1 $display("ports signed=%0d slice=%0d assembled=%h asc=%b",extended,sliced,assembled,ascending[0+:4]);
    source=8'bx101z010;
    #1 $display("ports signed=%b slice=%b assembled=%b asc=%b",extended,sliced,assembled,ascending[7-:4]);
    source=8'd127;
    #1 $display("ports signed=%0d slice=%0d assembled=%h",extended,sliced,assembled);
    $finish;
  end
endmodule
