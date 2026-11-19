module top;
function integer bound(input n);
  begin $finish; bound=2; end
endfunction
task automatic work;
  reg [bound(0):0] v;
  #3;
endtask
initial begin fork work; work; join $display("joined"); end
endmodule
