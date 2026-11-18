`timescale 1ns/1ps
module generated #(parameter MODE=0, FLIP=0)(input [3:0] a, output [3:0] y);
  wire [3:0] stage;
  genvar i;
  generate
    for (i=0; i<4; i=i+1) begin: lane
      wire selected;
      if (FLIP) begin: reverse
        assign selected = a[3-i];
      end else begin: forward
        assign selected = a[i];
      end
      assign stage[i] = selected;
    end
    case (MODE)
      0: begin: same assign y = stage; end
      1: begin: invert assign y = ~stage; end
      default: begin: rotate assign y = {stage[2:0],stage[3]}; end
    endcase
  endgenerate
endmodule
module tb;
  reg [3:0] a;
  wire [3:0] x, y, z;
  generated #(0,0) first(a,x);
  generated #(1,1) second(a,y);
  generated #(7,0) third(a,z);
  initial begin
    a=4'b1011;
    #1 $display("gen %b %b %b lane=%b",x,y,z,second.lane[0].selected);
    a=4'bx01z;
    #1 $display("gen %b %b %b lane=%b",x,y,z,first.lane[3].selected);
    $finish;
  end
endmodule
