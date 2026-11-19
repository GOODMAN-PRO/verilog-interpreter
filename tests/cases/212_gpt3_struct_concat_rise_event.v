module leaf(inout [1:0] p,input [1:0] d);
assign p=d;
endmodule
module top;
wire [1:0] bus; reg [1:0] val; integer hits;
leaf u({bus[1],bus[0]},val);
always @(posedge (bus == 2'b01)) if ($time>1) hits=hits+1;
initial begin hits=0;val=0; #3 val=3; #1 $display("%d",hits); end
endmodule
