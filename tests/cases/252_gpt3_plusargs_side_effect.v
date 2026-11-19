module top;
  function [7:0] flag(input x);
    begin $display("call"); flag = "A"; end
  endfunction
  initial $display("%0d", $test$plusargs(flag(1)));
endmodule
